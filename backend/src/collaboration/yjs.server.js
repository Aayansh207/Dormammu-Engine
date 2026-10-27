/**
 * NexFlow Yjs Real-Time CRDT Synchronization Server
 * Manages concurrent workflow editing, presence awareness, and role-based write guards.
 */

const { WebSocketServer } = require("ws");
const Y = require("yjs");
const syncProtocol = require("y-protocols/sync");
const awarenessProtocol = require("y-protocols/awareness");
const encoding = require("lib0/encoding");
const decoding = require("lib0/decoding");
const prisma = require("../config/db");
const { verifyAccessToken } = require("../utils/tokens");
const workflowService = require("../services/workflow.service");
const { validateWorkflow } = require("../engine/validator/workflow.validator");
const { defaultRegistry } = require("../engine/registry/node.registry");

const messageSync = 0;
const messageAwareness = 1;

class CollaborationServer {
  constructor() {
    this.rooms = new Map(); // workflowId -> RoomState
    this.wss = null;
  }

  /**
   * Initialize and attach the WebSocket server to the HTTP server
   * @param {import('http').Server} httpServer
   */
  init(httpServer) {
    this.wss = new WebSocketServer({ noServer: true });

    httpServer.on("upgrade", async (request, socket, head) => {
      try {
        const url = new URL(request.url, "http://localhost");

        const isCollab = url.pathname.startsWith("/collaboration") || url.pathname.startsWith("/ws/collaboration");
        if (!isCollab) {
          return; // Allow other upgrade handlers (if any)
        }

        let token = url.searchParams.get("token");
        let workflowId = url.searchParams.get("workflowId");

        // If workflowId is in the pathname, e.g. /ws/collaboration/:workflowId
        if (!workflowId) {
          const parts = url.pathname.split("/").filter(Boolean);
          if (parts.length > 0) {
            workflowId = parts[parts.length - 1];
          }
        }

        if (!token || !workflowId) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        const decoded = verifyAccessToken(token);
        if (!decoded || !decoded.sub) {
          socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
          socket.destroy();
          return;
        }

        // Verify session validity
        if (decoded.sid) {
          const session = await prisma.session.findUnique({
            where: { id: decoded.sid },
            select: { id: true, revokedAt: true, expiresAt: true },
          });
          if (!session || session.revokedAt || new Date() > new Date(session.expiresAt)) {
            socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
            socket.destroy();
            return;
          }
        }

        // Check user access and role
        let access;
        try {
          access = await workflowService.resolveWorkflowAccess(decoded.sub, workflowId);
        } catch (err) {
          socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
          socket.destroy();
          return;
        }

        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.handleConnection(ws, {
            userId: decoded.sub,
            email: decoded.email,
            role: access.role, // "OWNER" | "EDITOR" | "VIEWER"
            isReadOnly: access.role === "VIEWER",
            workflowId,
          });
        });
      } catch (err) {
        console.error("WebSocket upgrade error:", err);
        socket.destroy();
      }
    });

    console.log("⚡ NexFlow Yjs Real-Time Collaboration Server initialized.");
  }

  /**
   * Retrieve or instantiate a collaborative room for a workflow
   */
  async getOrCreateRoom(workflowId) {
    if (this.rooms.has(workflowId)) {
      return this.rooms.get(workflowId);
    }

    const doc = new Y.Doc();
    const awareness = new awarenessProtocol.Awareness(doc);
    const conns = new Map();

    const room = {
      workflowId,
      doc,
      awareness,
      conns,
      saveTimer: null,
      isInitialized: false,
    };

    // Load initial workflow definition from database
    const wf = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        versions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });

    const latest = wf?.versions?.[0];
    const def = latest?.definitionJson || { nodes: [], edges: [], name: wf?.name || "Untitled" };

    doc.transact(() => {
      const nodesMap = doc.getMap("nodes");
      const edgesArray = doc.getArray("edges");
      const metaMap = doc.getMap("meta");

      metaMap.set("name", wf?.name || "Untitled Workflow");
      metaMap.set("version", latest?.version || 1);

      // Populate nodes
      if (Array.isArray(def.nodes)) {
        for (const n of def.nodes) {
          nodesMap.set(n.id, n);
        }
      }

      // Populate edges
      if (Array.isArray(def.edges)) {
        edgesArray.push(def.edges);
      }
    }, "init");

    room.isInitialized = true;

    // Broadcast document updates to connected room peers
    doc.on("update", (update, origin) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      for (const [conn, meta] of room.conns) {
        if (conn !== origin && conn.readyState === 1 /* OPEN */) {
          conn.send(message);
        }
      }

      // Trigger debounced autosave so server restart or disconnect preserves state
      this.scheduleAutosave(room);
    });

    // Broadcast awareness updates (cursors, selection, user info)
    awareness.on("update", ({ added, updated, removed }, origin) => {
      const changedClients = added.concat(updated, removed);
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageAwareness);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
      );
      const message = encoding.toUint8Array(encoder);

      for (const [conn] of room.conns) {
        if (conn !== origin && conn.readyState === 1) {
          conn.send(message);
        }
      }
    });

    this.rooms.set(workflowId, room);
    return room;
  }

  /**
   * Handle an authorized WebSocket connection
   */
  async handleConnection(ws, clientInfo) {
    const { workflowId, userId, email, role, isReadOnly } = clientInfo;
    const room = await this.getOrCreateRoom(workflowId);

    room.conns.set(ws, { userId, email, role, isReadOnly });

    // Send initial sync step 1
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.writeSyncStep1(encoder, room.doc);
    ws.send(encoding.toUint8Array(encoder));

    // Send initial awareness states
    const awarenessStates = room.awareness.getStates();
    if (awarenessStates.size > 0) {
      const awarenessEncoder = encoding.createEncoder();
      encoding.writeVarUint(awarenessEncoder, messageAwareness);
      encoding.writeVarUint8Array(
        awarenessEncoder,
        awarenessProtocol.encodeAwarenessUpdate(
          room.awareness,
          Array.from(awarenessStates.keys())
        )
      );
      ws.send(encoding.toUint8Array(awarenessEncoder));
    }

    ws.on("message", (data) => {
      try {
        const uint8Array = new Uint8Array(data);
        const decoder = decoding.createDecoder(uint8Array);
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case messageSync: {
            // Guard: Viewers cannot publish modifications!
            if (isReadOnly) {
              const encoder = encoding.createEncoder();
              encoding.writeVarUint(encoder, messageSync);
              // Only reply with sync step if needed, discard remote write
              syncProtocol.readSyncMessage(decoder, encoder, room.doc, "readOnlyClient");
              // Do not broadcast changes from viewer
              return;
            }

            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageSync);
            syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);
            if (encoding.length(encoder) > 1) {
              ws.send(encoding.toUint8Array(encoder));
            }
            break;
          }
          case messageAwareness: {
            awarenessProtocol.applyAwarenessUpdate(
              room.awareness,
              decoding.readVarUint8Array(decoder),
              ws
            );
            break;
          }
          case 3: /* messageQueryAwareness */ {
            const currentAwareness = room.awareness.getStates();
            if (currentAwareness.size > 0) {
              const encoder = encoding.createEncoder();
              encoding.writeVarUint(encoder, messageAwareness);
              encoding.writeVarUint8Array(
                encoder,
                awarenessProtocol.encodeAwarenessUpdate(
                  room.awareness,
                  Array.from(currentAwareness.keys())
                )
              );
              ws.send(encoding.toUint8Array(encoder));
            }
            break;
          }
          default:
            break;
        }
      } catch (err) {
        console.error("Yjs WebSocket message error:", err.message);
      }
    });

    ws.on("close", () => {
      room.conns.delete(ws);
      // Remove awareness states for disconnected socket
      const states = room.awareness.getStates();
      for (const [clientId, state] of states.entries()) {
        if (state && state.user && state.user.userId === userId) {
          awarenessProtocol.removeAwareStates(room.awareness, [clientId], "disconnect");
        }
      }

      // If room is empty, flush pending autosave immediately
      if (room.conns.size === 0) {
        this.flushAutosave(room);
      }
    });

    ws.on("error", (err) => {
      console.warn("Yjs client connection error:", err.message);
      ws.close();
    });
  }

  /**
   * Schedule a debounced autosave of current CRDT state to PostgreSQL
   */
  scheduleAutosave(room) {
    if (room.saveTimer) {
      clearTimeout(room.saveTimer);
    }

    room.saveTimer = setTimeout(() => {
      this.flushAutosave(room);
    }, 3000); // 3-second debounce
  }

  /**
   * Persist current Yjs document state as a consistent workflow snapshot
   */
  async flushAutosave(room) {
    if (!room || !room.doc) return;
    if (room.saveTimer) {
      clearTimeout(room.saveTimer);
      room.saveTimer = null;
    }

    try {
      const nodesMap = room.doc.getMap("nodes");
      const edgesArray = room.doc.getArray("edges");
      const metaMap = room.doc.getMap("meta");

      const nodes = Array.from(nodesMap.values());
      const edges = edgesArray.toArray();
      const name = metaMap.get("name") || "Untitled Workflow";

      const definition = {
        schemaVersion: 1,
        name,
        nodes,
        edges,
      };

      // Find latest version record to update or increment
      const latestVersion = await prisma.workflowVersion.findFirst({
        where: { workflowId: room.workflowId },
        orderBy: { version: "desc" },
      });

      if (latestVersion) {
        await prisma.workflowVersion.update({
          where: { id: latestVersion.id },
          data: {
            definitionJson: definition,
          },
        });
      }

      await prisma.workflow.update({
        where: { id: room.workflowId },
        data: {
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      console.error(`Failed to autosave room ${room.workflowId}:`, err.message);
    }
  }

  /**
   * Revoke/disconnect all active connections for a specific user (e.g. membership removal)
   */
  revokeUserSessions(userId, workspaceId = null) {
    for (const room of this.rooms.values()) {
      for (const [ws, info] of room.conns.entries()) {
        if (info.userId === userId) {
          ws.send(JSON.stringify({ type: "revoked", message: "Your access has been revoked" }));
          ws.close(4403, "Access revoked");
          room.conns.delete(ws);
        }
      }
    }
  }
}

const defaultCollaborationServer = new CollaborationServer();

module.exports = {
  CollaborationServer,
  defaultCollaborationServer,
};
