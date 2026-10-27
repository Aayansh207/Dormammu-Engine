import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft,
  Save,
  Check,
  AlertCircle,
  Play,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sidebar as SidebarIcon,
  CheckCircle2,
  Loader2,
  Plus,
  Wand2,
  Sparkles,
  Zap,
  Radio,
  History,
  Users,
  Shield,
  Eye,
  Lock,
  Wifi,
  WifiOff,
} from "lucide-react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

import { api, BACKEND_URL } from "../../services/api";
import NodePalette from "./NodePalette";
import NodeCard from "./NodeCard";
import EdgePath, {
  calculatePortPosition,
  generateBezierPath,
} from "./EdgePath";
import NodeInspector from "./NodeInspector";
import ValidationDrawer from "./ValidationDrawer";
import RunExecutionModal from "./RunExecutionModal";
import WebhookTestingModal from "./WebhookTestingModal";
import PastRunsDrawer from "./PastRunsDrawer";
import VersionHistoryDrawer from "./VersionHistoryDrawer";
import QuickAddPopover from "./QuickAddPopover";
import { calculateAutoLayout } from "./autoLayout";

const COLLAB_COLORS = [
  "#39AEA9",
  "#F59E0B",
  "#EC4899",
  "#8B5CF6",
  "#3B82F6",
  "#10B981",
  "#F97316",
  "#06B6D4",
];

const getCollabColor = (str) => {
  let hash = 0;
  for (let i = 0; i < (str || "").length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
};

export default function WorkflowEditor({
  workflowId,
  onBack,
  onOpenReport,
}) {
  // Core workflow state
  const [workflow, setWorkflow] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [workflowName, setWorkflowName] = useState("Untitled Workflow");
  const [workflowVersion, setWorkflowVersion] = useState(1);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState("");

  // Collaboration and Permissions State
  const [currentUserRole, setCurrentUserRole] = useState("VIEWER"); // "OWNER" | "EDITOR" | "VIEWER"
  const [collaborators, setCollaborators] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); // "connecting" | "connected" | "disconnected"
  const [remoteSelectedNodes, setRemoteSelectedNodes] = useState({}); // nodeId -> { name, color }
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);

  const ydocRef = useRef(null);
  const providerRef = useRef(null);
  const isRemoteApplyingRef = useRef(false);

  // Catalogue
  const [catalogue, setCatalogue] = useState([]);
  const [catalogueMap, setCatalogueMap] = useState({});

  // Canvas viewport
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 60 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Selection and panels
  const [selectedElement, setSelectedElement] = useState(null);
  const [isPaletteOpen, setIsPaletteOpen] = useState(true);
  const [isValidationDrawerOpen, setIsValidationDrawerOpen] =
    useState(false);
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [isPastRunsDrawerOpen, setIsPastRunsDrawerOpen] = useState(false);

  const [recentRuns, setRecentRuns] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeRunId, setActiveRunId] = useState(null);

  const sseUnsubRef = useRef(null);
  const mountedRef = useRef(false);
  const validationTimerRef = useRef(null);
  const saveMessageTimerRef = useRef(null);

  // Quick Add popover
  const [quickAdd, setQuickAdd] = useState({
    isOpen: false,
    screenX: 0,
    screenY: 0,
    canvasX: 0,
    canvasY: 0,
    autoConnectSource: null,
  });

  // Validation
  const [validationResult, setValidationResult] = useState({
    valid: true,
    errors: [],
    warnings: [],
  });
  const [isValidating, setIsValidating] = useState(false);

  // Node dragging
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const dragStartOffsetRef = useRef({
    mouseX: 0,
    mouseY: 0,
    nodeX: 0,
    nodeY: 0,
  });

  // Connection dragging
  const [connectingSource, setConnectingSource] = useState(null);
  const [connectingMousePos, setConnectingMousePos] = useState(null);

  // Execution
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);

  const canvasRef = useRef(null);

  // Stable live state reference for event handlers
  const stateRef = useRef(null);

  stateRef.current = {
    workflowName,
    nodes,
    edges,
    workflowId,
    isDirty,
    selectedElement,
    scale,
    pan,
  };

  // Build workflow definition
  const getWorkflowJson = useCallback(
    (customNodes = null, customEdges = null) => ({
      schemaVersion: 1,
      name: stateRef.current.workflowName,
      nodes: customNodes ?? stateRef.current.nodes,
      edges: customEdges ?? stateRef.current.edges,
    }),
    []
  );

  // Cleanup helpers
  const clearSSESubscription = useCallback(() => {
    if (sseUnsubRef.current) {
      try {
        sseUnsubRef.current();
      } catch (err) {
        console.warn("Failed to close run event subscription:", err);
      }

      sseUnsubRef.current = null;
    }
  }, []);

  // Validate workflow definition
  const validateDefinition = useCallback(
    (customDef = null, delay = 200) => {
      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
        validationTimerRef.current = null;
      }

      const runValidation = async () => {
        setIsValidating(true);

        try {
          const definition = customDef || getWorkflowJson();
          const res = await api.validateRawWorkflow(definition);

          if (res?.data) {
            setValidationResult(res.data);
          }
        } catch (err) {
          console.error("Validation error:", err);
        } finally {
          setIsValidating(false);
        }
      };

      if (delay === 0) {
        void runValidation();
      } else {
        validationTimerRef.current = setTimeout(() => {
          validationTimerRef.current = null;
          void runValidation();
        }, delay);
      }
    },
    [getWorkflowJson]
  );

  // Broadcast local changes to Yjs CRDT document
  const syncLocalChange = useCallback((nextNodes, nextEdges, nextName = null) => {
    if (currentUserRole === "VIEWER") return;
    const doc = ydocRef.current;
    if (!doc) return;

    doc.transact(() => {
      const nodesMap = doc.getMap("nodes");
      const edgesArray = doc.getArray("edges");
      const metaMap = doc.getMap("meta");

      if (nextNodes) {
        const nextNodeIds = new Set(nextNodes.map((n) => n.id));
        for (const existingId of nodesMap.keys()) {
          if (!nextNodeIds.has(existingId)) {
            nodesMap.delete(existingId);
          }
        }
        for (const node of nextNodes) {
          nodesMap.set(node.id, node);
        }
      }

      if (nextEdges) {
        edgesArray.delete(0, edgesArray.length);
        edgesArray.push(nextEdges);
      }

      if (nextName) {
        metaMap.set("name", nextName);
      }
    }, "local");
  }, [currentUserRole]);

  // Save workflow definition
  const handleSave = useCallback(async () => {
    if (currentUserRole === "VIEWER") {
      alert("Forbidden: Viewers cannot save workflow modifications.");
      return false;
    }

    const currentId = stateRef.current.workflowId;

    if (!currentId) {
      return false;
    }

    if (isSaving) {
      return false;
    }

    setIsSaving(true);
    setSaveSuccessMsg("");

    try {
      const definition = getWorkflowJson();

      const res = await api.updateWorkflow(currentId, {
        name: stateRef.current.workflowName,
        definition,
      });

      if (!res?.data) {
        throw new Error("The server returned an empty save response.");
      }

      setWorkflow(res.data);
      setWorkflowVersion(res.data.version ?? 1);
      setIsDirty(false);

      setSaveSuccessMsg(
        `Saved as v${res.data.version ?? 1}`
      );

      // Sync updated version to Yjs meta
      const doc = ydocRef.current;
      if (doc) {
        doc.transact(() => {
          doc.getMap("meta").set("version", res.data.version ?? 1);
        }, "local");
      }

      if (saveMessageTimerRef.current) {
        clearTimeout(saveMessageTimerRef.current);
      }

      saveMessageTimerRef.current = setTimeout(() => {
        setSaveSuccessMsg("");
        saveMessageTimerRef.current = null;
      }, 3000);

      if (res.data.validation) {
        setValidationResult(res.data.validation);
      }

      return true;
    } catch (err) {
      console.error("Failed to save workflow:", err);
      alert(`Save failed: ${err.message || "Unknown error"}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [currentUserRole, getWorkflowJson, isSaving]);

  // Delete node and connected edges
  const handleDeleteNode = useCallback(
    (nodeId) => {
      if (currentUserRole === "VIEWER") {
        alert("Forbidden: Viewers cannot delete nodes.");
        return;
      }

      const nextNodes = stateRef.current.nodes.filter(
        (node) => node.id !== nodeId
      );

      const nextEdges = stateRef.current.edges.filter(
        (edge) =>
          edge.source !== nodeId && edge.target !== nodeId
      );

      setNodes(nextNodes);
      setEdges(nextEdges);

      setSelectedElement((prev) =>
        prev?.id === nodeId ? null : prev
      );

      setIsDirty(true);
      syncLocalChange(nextNodes, nextEdges);

      validateDefinition(
        {
          ...getWorkflowJson(nextNodes, nextEdges),
          nodes: nextNodes,
          edges: nextEdges,
        }
      );
    },
    [currentUserRole, getWorkflowJson, syncLocalChange, validateDefinition]
  );

  // Delete edge
  const handleDeleteEdge = useCallback(
    (edgeId) => {
      if (currentUserRole === "VIEWER") {
        alert("Forbidden: Viewers cannot delete connections.");
        return;
      }

      const nextEdges = stateRef.current.edges.filter(
        (edge) => edge.id !== edgeId
      );

      setEdges(nextEdges);

      setSelectedElement((prev) =>
        prev?.id === edgeId ? null : prev
      );

      setIsDirty(true);
      syncLocalChange(null, nextEdges);

      validateDefinition(getWorkflowJson(null, nextEdges));
    },
    [currentUserRole, getWorkflowJson, syncLocalChange, validateDefinition]
  );

  // Load node catalogue
  useEffect(() => {
    let cancelled = false;

    async function loadCatalogue() {
      try {
        const response = await api.getNodeCatalogue();

        if (cancelled || !response?.data) {
          return;
        }

        setCatalogue(response.data);

        const map = {};

        for (const item of response.data) {
          map[item.type] = item;
        }

        setCatalogueMap(map);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load node catalogue:", err);
        }
      }
    }

    void loadCatalogue();

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch execution history
  const fetchRecentRuns = useCallback(async (wfId) => {
    if (!wfId) {
      setRecentRuns([]);
      return;
    }

    setIsLoadingHistory(true);

    try {
      const response = await api.listWorkflowRuns(wfId);

      if (response?.data) {
        setRecentRuns(
          Array.isArray(response.data) ? response.data : []
        );
      } else {
        setRecentRuns([]);
      }
    } catch (err) {
      console.warn("Failed to fetch recent runs:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // Load an existing execution report
  const loadRunById = useCallback(
    async (runId) => {
      if (!runId) {
        return;
      }

      try {
        const response = await api.getRunDetails(runId);

        if (!response?.data) {
          return;
        }

        const runData = response.data;

        if (
          runData.workflowId &&
          workflowId &&
          String(runData.workflowId) !== String(workflowId)
        ) {
          console.warn(
            "Run does not belong to the current workflow."
          );

          const url = new URL(window.location.href);
          url.searchParams.delete("runId");

          window.history.replaceState(
            {},
            "",
            url.pathname + url.search + url.hash
          );

          return;
        }

        const normalized = {
          ...runData,
          id: runData.id || runData.runId || runId,
          runId: runData.runId || runData.id || runId,
          finalOutput:
            runData.finalOutput !== undefined
              ? runData.finalOutput
              : runData.output,
          tasks:
            runData.tasks ||
            (Array.isArray(runData.taskRuns)
              ? Object.fromEntries(
                runData.taskRuns.map((task) => [
                  task.nodeId,
                  task,
                ])
              )
              : {}),
        };

        setRunResult(normalized);
        setActiveRunId(normalized.runId);

        if (
          normalized.status === "RUNNING" ||
          normalized.status === "QUEUED"
        ) {
          startLiveRunTracking(normalized.runId);
        }
      } catch (err) {
        console.warn(
          "Could not load execution run details:",
          err.message
        );

        const url = new URL(window.location.href);

        if (url.searchParams.has("runId")) {
          url.searchParams.delete("runId");

          window.history.replaceState(
            {},
            "",
            url.pathname + url.search + url.hash
          );
        }
      }
    },
    [workflowId]
  );

  // Load workflow and history
  useEffect(() => {
    if (!workflowId) {
      return;
    }

    let cancelled = false;

    clearSSESubscription();

    setWorkflow(null);
    setNodes([]);
    setEdges([]);
    setWorkflowName("Untitled Workflow");
    setWorkflowVersion(1);
    setSelectedElement(null);
    setRunResult(null);
    setActiveRunId(null);
    setRecentRuns([]);
    setIsDirty(false);
    setIsLoadingHistory(true);

    async function loadWorkflow() {
      try {
        const response = await api.getWorkflow(workflowId);

        if (cancelled || !response?.data) {
          return;
        }

        const wf = response.data;
        const definition = wf.definition || {
          nodes: [],
          edges: [],
        };

        setWorkflow(wf);
        setWorkflowName(wf.name || "Untitled Workflow");
        setWorkflowVersion(wf.version || 1);
        setNodes(definition.nodes || []);
        setEdges(definition.edges || []);
        setCurrentUserRole(wf.currentUserRole || "VIEWER");
        setIsDirty(false);

        validateDefinition(definition, 0);
      } catch (err) {
        if (!cancelled) {
          console.error(
            "Failed to load workflow editor:",
            err
          );
        }
      }
    }

    void loadWorkflow();
    void fetchRecentRuns(workflowId);

    const urlParams = new URLSearchParams(
      window.location.search
    );
    const queryRunId = urlParams.get("runId");

    if (queryRunId) {
      void loadRunById(queryRunId);
    }

    return () => {
      cancelled = true;

      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
        validationTimerRef.current = null;
      }

      clearSSESubscription();
    };
  }, [
    workflowId,
    validateDefinition,
    fetchRecentRuns,
    loadRunById,
    clearSSESubscription,
  ]);

  // Real-Time Yjs CRDT Synchronization & Presence Awareness
  useEffect(() => {
    if (!workflowId || !api.accessToken) return;

    const doc = new Y.Doc();
    ydocRef.current = doc;

    const wsUrl = BACKEND_URL.replace(/^http/, "ws") + "/ws/collaboration";
    let provider = null;

    try {
      provider = new WebsocketProvider(wsUrl, workflowId, doc, {
        params: {
          token: api.accessToken,
          workflowId: workflowId,
        },
        connect: true,
      });
      providerRef.current = provider;

      provider.on("status", (event) => {
        setConnectionStatus(event.status); // "connected" | "connecting" | "disconnected"
      });

      const myColor = getCollabColor(api.currentUser?.id || "user");
      provider.awareness.setLocalStateField("user", {
        id: api.currentUser?.id,
        name: api.currentUser?.name || api.currentUser?.email || "User",
        email: api.currentUser?.email,
        color: myColor,
      });

      provider.awareness.on("change", () => {
        const states = provider.awareness.getStates();
        const active = [];
        const remoteSel = {};
        for (const [clientId, state] of states.entries()) {
          if (clientId !== doc.clientID && state?.user) {
            active.push({ clientId, ...state });
            if (state.selectedNodeId) {
              remoteSel[state.selectedNodeId] = {
                name: state.user.name || "Collaborator",
                color: state.user.color || "#39AEA9",
              };
            }
          }
        }
        setCollaborators(active);
        setRemoteSelectedNodes(remoteSel);
      });

      const handleDocUpdate = (update, origin) => {
        if (origin === "local" || isRemoteApplyingRef.current) return;
        isRemoteApplyingRef.current = true;
        try {
          const nodesMap = doc.getMap("nodes");
          const edgesArray = doc.getArray("edges");
          const metaMap = doc.getMap("meta");

          const syncedNodes = Array.from(nodesMap.values());
          const syncedEdges = edgesArray.toArray();
          const syncedName = metaMap.get("name");
          const syncedVersion = metaMap.get("version");

          if (syncedNodes.length > 0 || syncedEdges.length > 0) {
            setNodes(syncedNodes);
            setEdges(syncedEdges);
            if (syncedName) setWorkflowName(syncedName);
            if (syncedVersion) setWorkflowVersion(syncedVersion);
            validateDefinition({ nodes: syncedNodes, edges: syncedEdges, name: syncedName }, 300);
          }
        } finally {
          isRemoteApplyingRef.current = false;
        }
      };

      doc.on("update", handleDocUpdate);
    } catch (err) {
      console.warn("Yjs WebsocketProvider initialization error:", err);
    }

    return () => {
      if (provider) {
        try {
          provider.destroy();
        } catch (e) {}
      }
      if (doc) {
        try {
          doc.destroy();
        } catch (e) {}
      }
      ydocRef.current = null;
      providerRef.current = null;
    };
  }, [workflowId, validateDefinition]);

  // Keep awareness updated when selected node changes
  useEffect(() => {
    if (providerRef.current?.awareness) {
      providerRef.current.awareness.setLocalStateField(
        "selectedNodeId",
        selectedElement?.type === "node" ? selectedElement.id : null
      );
    }
  }, [selectedElement]);

  // Add node
  const handleAddNode = useCallback(
    (catalogueNode, customPos = null, autoConnectSource = null) => {
      if (currentUserRole === "VIEWER") {
        alert("Forbidden: Viewers cannot add nodes.");
        return;
      }
      if (!catalogueNode) {
        return;
      }

      let index = stateRef.current.nodes.length + 1;
      let newId = `node_${String(index).padStart(2, "0")}`;

      while (
        stateRef.current.nodes.some((node) => node.id === newId)
      ) {
        index++;
        newId = `node_${String(index).padStart(2, "0")}`;
      }

      let posX;
      let posY;

      if (customPos) {
        posX = customPos.x;
        posY = customPos.y;
      } else {
        const container = canvasRef.current;
        const viewWidth = container?.clientWidth || 800;
        const viewHeight = container?.clientHeight || 600;

        posX = Math.round(
          (-pan.x + viewWidth / 2 - 120) / scale
        );

        posY = Math.round(
          (-pan.y + viewHeight / 2 - 60) / scale
        );
      }

      const initialConfig = {};

      if (catalogueNode.configSchema) {
        for (const [key, schema] of Object.entries(
          catalogueNode.configSchema
        )) {
          if (schema.default !== undefined) {
            initialConfig[key] = schema.default;
          }
        }
      }

      const newNode = {
        id: newId,
        type: catalogueNode.type,
        version: catalogueNode.version || 1,
        name: catalogueNode.label || newId,
        position: {
          x: posX,
          y: posY,
        },
        config: initialConfig,
      };

      const currentNodes = stateRef.current.nodes;
      const currentEdges = stateRef.current.edges;

      const nextNodes = [...currentNodes, newNode];
      let nextEdges = [...currentEdges];

      if (autoConnectSource?.nodeId) {
        const inputKeys = Object.keys(
          catalogueNode.inputs || {}
        );

        const targetPort = inputKeys.includes("input")
          ? "input"
          : inputKeys[0];

        if (targetPort) {
          let edgeIndex = nextEdges.length + 1;
          let edgeId = `edge_${String(edgeIndex).padStart(2, "0")}`;

          while (nextEdges.some((edge) => edge.id === edgeId)) {
            edgeIndex++;
            edgeId = `edge_${String(edgeIndex).padStart(2, "0")}`;
          }

          nextEdges.push({
            id: edgeId,
            source: autoConnectSource.nodeId,
            sourcePort: autoConnectSource.portName,
            target: newId,
            targetPort,
          });
        }
      }

      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelectedElement({
        id: newId,
        type: "node",
      });
      setIsDirty(true);
      syncLocalChange(nextNodes, nextEdges);

      validateDefinition(
        {
          ...getWorkflowJson(nextNodes, nextEdges),
          nodes: nextNodes,
          edges: nextEdges,
        }
      );
    },
    [
      currentUserRole,
      getWorkflowJson,
      syncLocalChange,
      validateDefinition,
      pan.x,
      pan.y,
      scale,
    ]
  );

  // Open Quick Add from toolbar
  const handleOpenQuickAddFromToolbar = useCallback(() => {
    const container = canvasRef.current;
    const viewWidth = container?.clientWidth || 800;
    const viewHeight = container?.clientHeight || 600;

    const canvasX = Math.round(
      (-pan.x + viewWidth / 2 - 120) / scale
    );

    const canvasY = Math.round(
      (-pan.y + viewHeight / 2 - 60) / scale
    );

    setQuickAdd({
      isOpen: true,
      screenX: window.innerWidth / 2,
      screenY: window.innerHeight / 2 - 100,
      canvasX,
      canvasY,
      autoConnectSource: null,
    });
  }, [pan.x, pan.y, scale]);

  // Quick connect from a node
  const handleQuickConnect = useCallback(
    (sourceNodeId, sourcePortName, event) => {
      const sourceNode = stateRef.current.nodes.find(
        (node) => node.id === sourceNodeId
      );

      const canvasX = sourceNode
        ? sourceNode.position.x + 360
        : 300;

      const canvasY = sourceNode
        ? sourceNode.position.y
        : 200;

      setQuickAdd({
        isOpen: true,
        screenX: event
          ? event.clientX + 10
          : window.innerWidth / 2,
        screenY: event
          ? event.clientY
          : window.innerHeight / 2,
        canvasX,
        canvasY,
        autoConnectSource: {
          nodeId: sourceNodeId,
          portName: sourcePortName,
        },
      });
    },
    []
  );

  // Auto layout
  const handleAutoLayout = useCallback(() => {
    if (currentUserRole === "VIEWER") return;
    const tidied = calculateAutoLayout(
      stateRef.current.nodes,
      stateRef.current.edges
    );

    setNodes(tidied);
    setIsDirty(true);
    syncLocalChange(tidied, null);

    validateDefinition({
      ...getWorkflowJson(tidied),
      nodes: tidied,
    });
  }, [currentUserRole, getWorkflowJson, syncLocalChange, validateDefinition]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;

      const isEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(
            target.tagName
          ));

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === "s"
      ) {
        event.preventDefault();
        void handleSave();
        return;
      }

      if (isEditable) {
        return;
      }

      if (event.code === "Space" || event.key === "/") {
        event.preventDefault();
        handleOpenQuickAddFromToolbar();
        return;
      }

      if (
        (event.key === "t" || event.key === "T") &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        handleAutoLayout();
        return;
      }

      if (
        event.key === "Delete" ||
        event.key === "Backspace"
      ) {
        const selected = stateRef.current.selectedElement;

        if (!selected) {
          return;
        }

        event.preventDefault();

        if (selected.type === "node") {
          handleDeleteNode(selected.id);
        } else if (selected.type === "edge") {
          handleDeleteEdge(selected.id);
        }

        return;
      }

      if (event.key === "Escape") {
        setSelectedElement(null);
        setConnectingSource(null);
        setConnectingMousePos(null);

        setQuickAdd((prev) => ({
          ...prev,
          isOpen: false,
          autoConnectSource: null,
        }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    handleSave,
    handleDeleteNode,
    handleDeleteEdge,
    handleOpenQuickAddFromToolbar,
    handleAutoLayout,
  ]);

  // Release drag/pan on window mouseup
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (draggingNodeId && currentUserRole !== "VIEWER") {
        syncLocalChange(stateRef.current.nodes, null);
      }
      setDraggingNodeId(null);
      setIsPanning(false);
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener(
        "mouseup",
        handleGlobalMouseUp
      );
    };
  }, [currentUserRole, draggingNodeId, syncLocalChange]);

  // Global cleanup
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (validationTimerRef.current) {
        clearTimeout(validationTimerRef.current);
      }

      if (saveMessageTimerRef.current) {
        clearTimeout(saveMessageTimerRef.current);
      }

      clearSSESubscription();
    };
  }, [clearSSESubscription]);

  // Drag-and-drop node onto canvas
  const handleCanvasDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleCanvasDrop = (event) => {
    event.preventDefault();
    if (currentUserRole === "VIEWER") return;

    const rawData = event.dataTransfer.getData(
      "application/dormammu-node"
    );

    if (!rawData) {
      return;
    }

    try {
      const nodeMeta = JSON.parse(rawData);
      const container = canvasRef.current;

      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();

      const dropX = Math.round(
        (event.clientX - rect.left - pan.x) / scale - 120
      );

      const dropY = Math.round(
        (event.clientY - rect.top - pan.y) / scale - 30
      );

      handleAddNode(nodeMeta, {
        x: dropX,
        y: dropY,
      });
    } catch (err) {
      console.error(
        "Failed to parse dropped node metadata:",
        err
      );
    }
  };

  // Double-click canvas to add node
  const handleCanvasDoubleClick = (event) => {
    if (currentUserRole === "VIEWER") return;
    const target = event.target;

    if (
      target !== canvasRef.current &&
      target.tagName !== "svg" &&
      !target.classList.contains("workflow-canvas-grid")
    ) {
      return;
    }

    const container = canvasRef.current;

    if (!container) {
      return;
    }

    const rect = container.getBoundingClientRect();

    const canvasX = Math.round(
      (event.clientX - rect.left - pan.x) / scale - 120
    );

    const canvasY = Math.round(
      (event.clientY - rect.top - pan.y) / scale - 30
    );

    setQuickAdd({
      isOpen: true,
      screenX: event.clientX,
      screenY: event.clientY,
      canvasX,
      canvasY,
      autoConnectSource: null,
    });
  };

  // Update node
  const handleUpdateNode = (updatedNode) => {
    if (currentUserRole === "VIEWER") return;
    const nextNodes = stateRef.current.nodes.map((node) =>
      node.id === updatedNode.id ? updatedNode : node
    );

    setNodes(nextNodes);
    setIsDirty(true);
    syncLocalChange(nextNodes, null);

    validateDefinition({
      ...getWorkflowJson(nextNodes),
      nodes: nextNodes,
    });
  };

  // Start node dragging
  const handleStartDragNode = (nodeId, event) => {
    if (currentUserRole === "VIEWER") return;
    const node = stateRef.current.nodes.find(
      (item) => item.id === nodeId
    );

    if (!node) {
      return;
    }

    setSelectedElement({
      id: nodeId,
      type: "node",
    });

    setDraggingNodeId(nodeId);

    dragStartOffsetRef.current = {
      mouseX: event.clientX,
      mouseY: event.clientY,
      nodeX: node.position.x,
      nodeY: node.position.y,
    };
  };

  // Start connection
  const handleStartConnection = (
    nodeId,
    portName,
    event
  ) => {
    if (currentUserRole === "VIEWER") return;
    setConnectingSource({
      nodeId,
      portName,
    });

    if (canvasRef.current && event) {
      const rect = canvasRef.current.getBoundingClientRect();

      setConnectingMousePos({
        x:
          (event.clientX - rect.left - pan.x) / scale,
        y:
          (event.clientY - rect.top - pan.y) / scale,
      });
    }
  };

  // Complete connection
  const handleCompleteConnection = (
    targetNodeId,
    targetPortName
  ) => {
    if (currentUserRole === "VIEWER") {
      setConnectingSource(null);
      setConnectingMousePos(null);
      return;
    }
    const source = connectingSource;

    if (!source) {
      return;
    }

    const sourceNodeId = source.nodeId;
    const sourcePortName = source.portName;

    if (sourceNodeId === targetNodeId) {
      setConnectingSource(null);
      setConnectingMousePos(null);
      return;
    }

    const currentEdges = stateRef.current.edges;

    const exists = currentEdges.some(
      (edge) =>
        edge.source === sourceNodeId &&
        edge.sourcePort === sourcePortName &&
        edge.target === targetNodeId &&
        edge.targetPort === targetPortName
    );

    if (!exists) {
      const targetNode = stateRef.current.nodes.find(
        (node) => node.id === targetNodeId
      );

      const targetMetadata = targetNode
        ? catalogueMap[targetNode.type]
        : null;

      const targetPortDefinition =
        targetMetadata?.inputs?.[targetPortName];

      const allowsMultiple = Boolean(
        targetPortDefinition?.allowMultiple
      );

      const cleanEdges = allowsMultiple
        ? currentEdges
        : currentEdges.filter(
          (edge) =>
            !(
              edge.target === targetNodeId &&
              edge.targetPort === targetPortName
            )
        );

      let edgeIndex = cleanEdges.length + 1;
      let edgeId = `edge_${String(edgeIndex).padStart(2, "0")}`;

      while (cleanEdges.some((edge) => edge.id === edgeId)) {
        edgeIndex++;
        edgeId = `edge_${String(edgeIndex).padStart(2, "0")}`;
      }

      const nextEdges = [
        ...cleanEdges,
        {
          id: edgeId,
          source: sourceNodeId,
          sourcePort: sourcePortName,
          target: targetNodeId,
          targetPort: targetPortName,
        },
      ];

      setEdges(nextEdges);
      setIsDirty(true);
      syncLocalChange(null, nextEdges);

      validateDefinition({
        ...getWorkflowJson(null, nextEdges),
        edges: nextEdges,
      });
    }

    setConnectingSource(null);
    setConnectingMousePos(null);
  };

  // Canvas mouse movement
  const handleCanvasMouseMove = (event) => {
    if (draggingNodeId) {
      const dx =
        (event.clientX -
          dragStartOffsetRef.current.mouseX) /
        scale;

      const dy =
        (event.clientY -
          dragStartOffsetRef.current.mouseY) /
        scale;

      const newX = Math.round(
        dragStartOffsetRef.current.nodeX + dx
      );

      const newY = Math.round(
        dragStartOffsetRef.current.nodeY + dy
      );

      setNodes((previous) =>
        previous.map((node) =>
          node.id === draggingNodeId
            ? {
              ...node,
              position: {
                x: newX,
                y: newY,
              },
            }
            : node
        )
      );

      setIsDirty(true);
    } else if (isPanning) {
      const dx =
        event.clientX - panStartRef.current.x;

      const dy =
        event.clientY - panStartRef.current.y;

      setPan((previous) => ({
        x: previous.x + dx,
        y: previous.y + dy,
      }));

      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
    } else if (connectingSource && canvasRef.current) {
      const rect =
        canvasRef.current.getBoundingClientRect();

      setConnectingMousePos({
        x:
          (event.clientX - rect.left - pan.x) /
          scale,
        y:
          (event.clientY - rect.top - pan.y) /
          scale,
      });
    }
  };

  // Canvas mouse release
  const handleCanvasMouseUp = (event) => {
    if (draggingNodeId) {
      setDraggingNodeId(null);
    }

    if (isPanning) {
      setIsPanning(false);
    }

    if (connectingSource) {
      if (connectingMousePos && canvasRef.current) {
        const rect =
          canvasRef.current.getBoundingClientRect();

        const canvasX = Math.round(
          connectingMousePos.x - 120
        );

        const canvasY = Math.round(
          connectingMousePos.y - 30
        );

        setQuickAdd({
          isOpen: true,
          screenX: event
            ? event.clientX
            : rect.left +
            connectingMousePos.x * scale +
            pan.x,
          screenY: event
            ? event.clientY
            : rect.top +
            connectingMousePos.y * scale +
            pan.y,
          canvasX,
          canvasY,
          autoConnectSource: connectingSource,
        });
      }

      setConnectingSource(null);
      setConnectingMousePos(null);
    }
  };

  // Canvas mouse down
  const handleCanvasMouseDown = (event) => {
    const target = event.target;

    if (
      target === canvasRef.current ||
      target.tagName === "svg" ||
      target.classList.contains("workflow-canvas-grid")
    ) {
      setSelectedElement(null);
      setIsPanning(true);

      panStartRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
    }
  };

  // Zoom
  const handleWheel = (event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();

      const zoomFactor =
        event.deltaY < 0 ? 1.08 : 0.92;

      setScale((previous) =>
        Math.min(
          Math.max(previous * zoomFactor, 0.4),
          2.2
        )
      );
    }
  };

  // Subscribe to live execution events
  const startLiveRunTracking = useCallback(
    (targetRunId) => {
      if (!targetRunId) {
        return;
      }

      clearSSESubscription();

      const unsubscribe = api.subscribeToRunEvents(
        targetRunId,
        (event) => {
          if (!event?.type) {
            return;
          }

          setRunResult((previous) => {
            if (!previous) {
              return previous;
            }

            const currentTasks = {
              ...(previous.tasks || {}),
            };

            if (
              event.type === "task:running" &&
              event.nodeId
            ) {
              currentTasks[event.nodeId] = {
                ...(currentTasks[event.nodeId] || {}),
                nodeId: event.nodeId,
                status: "RUNNING",
                startedAt:
                  event.timestamp ||
                  new Date().toISOString(),
              };

              return {
                ...previous,
                status: "RUNNING",
                tasks: currentTasks,
              };
            }

            if (
              event.type === "task:succeeded" &&
              event.nodeId
            ) {
              currentTasks[event.nodeId] = {
                ...(currentTasks[event.nodeId] || {}),
                nodeId: event.nodeId,
                status: "SUCCEEDED",
                outputs: event.output,
                output: event.output,
                durationMs: event.durationMs,
                completedAt:
                  event.timestamp ||
                  new Date().toISOString(),
              };

              return {
                ...previous,
                tasks: currentTasks,
              };
            }

            if (
              event.type === "task:failed" &&
              event.nodeId
            ) {
              currentTasks[event.nodeId] = {
                ...(currentTasks[event.nodeId] || {}),
                nodeId: event.nodeId,
                status: "FAILED",
                error: event.error,
                durationMs: event.durationMs,
                completedAt:
                  event.timestamp ||
                  new Date().toISOString(),
              };

              return {
                ...previous,
                tasks: currentTasks,
              };
            }

            if (
              event.type === "task:skipped" &&
              event.nodeId
            ) {
              currentTasks[event.nodeId] = {
                ...(currentTasks[event.nodeId] || {}),
                nodeId: event.nodeId,
                status: "SKIPPED",
              };

              return {
                ...previous,
                tasks: currentTasks,
              };
            }

            if (event.type === "workflow:completed") {
              void fetchRecentRuns(workflowId);

              return {
                ...previous,
                status: "SUCCEEDED",
                durationMs:
                  event.durationMs ??
                  previous.durationMs,
                finalOutput:
                  event.output !== undefined
                    ? event.output
                    : previous.finalOutput,
                output:
                  event.output !== undefined
                    ? event.output
                    : previous.output,
                tasks: currentTasks,
              };
            }

            if (event.type === "workflow:failed") {
              void fetchRecentRuns(workflowId);

              return {
                ...previous,
                status: "FAILED",
                error: event.error || previous.error,
                durationMs:
                  event.durationMs ??
                  previous.durationMs,
                tasks: currentTasks,
              };
            }

            return previous;
          });
        },
        (err) => {
          console.warn(
            "SSE stream closed or completed:",
            err
          );
        }
      );

      sseUnsubRef.current =
        typeof unsubscribe === "function"
          ? unsubscribe
          : null;
    },
    [
      workflowId,
      fetchRecentRuns,
      clearSSESubscription,
    ]
  );

  // Restore earlier workflow version
  const handleRestoreVersion = useCallback(
    (data) => {
      const restoredWf = data?.workflow || data;
      if (!restoredWf) return;
      setWorkflow(restoredWf);
      setWorkflowVersion(restoredWf.version || 1);
      const def = restoredWf.definition || { nodes: [], edges: [] };
      setNodes(def.nodes || []);
      setEdges(def.edges || []);
      if (restoredWf.name) setWorkflowName(restoredWf.name);
      setIsDirty(false);
      syncLocalChange(def.nodes || [], def.edges || [], restoredWf.name);
      const doc = ydocRef.current;
      if (doc) {
        doc.transact(() => {
          doc.getMap("meta").set("version", restoredWf.version || 1);
        }, "local");
      }
      validateDefinition(def, 0);
      setIsVersionHistoryOpen(false);
      setSaveSuccessMsg(`Restored to v${restoredWf.version || 1}`);
      if (saveMessageTimerRef.current) clearTimeout(saveMessageTimerRef.current);
      saveMessageTimerRef.current = setTimeout(() => {
        setSaveSuccessMsg("");
        saveMessageTimerRef.current = null;
      }, 3500);
    },
    [syncLocalChange, validateDefinition]
  );

  // Execute workflow
  const handleExecuteRun = async (triggerData) => {
    if (currentUserRole === "VIEWER") {
      alert("Forbidden: Viewers cannot execute workflows.");
      return;
    }
    setIsRunning(true);

    try {
      // Save changes before executing.
      if (stateRef.current.isDirty) {
        const saved = await handleSave();

        if (!saved) {
          throw new Error(
            "Workflow could not be saved. Execution was cancelled."
          );
        }
      }

      const response = await api.executeWorkflow(
        workflowId,
        { triggerData }
      );

      if (!response?.data) {
        throw new Error(
          "The server returned an empty execution response."
        );
      }

      const runData = response.data;

      const normalized = {
        ...runData,
        id: runData.id || runData.runId,
        runId: runData.runId || runData.id,
        finalOutput:
          runData.finalOutput !== undefined
            ? runData.finalOutput
            : runData.output,
        tasks:
          runData.tasks ||
          (Array.isArray(runData.taskRuns)
            ? Object.fromEntries(
              runData.taskRuns.map((task) => [
                task.nodeId,
                task,
              ])
            )
            : {}),
      };

      setRunResult(normalized);
      setActiveRunId(normalized.runId);

      if (normalized.runId) {
        const url = new URL(window.location.href);
        url.searchParams.set("runId", normalized.runId);

        window.history.replaceState(
          {},
          "",
          url.pathname + url.search + url.hash
        );
      }

      void fetchRecentRuns(workflowId);

      if (
        normalized.runId &&
        (
          normalized.status === "RUNNING" ||
          normalized.status === "QUEUED"
        )
      ) {
        startLiveRunTracking(normalized.runId);
      }
    } catch (err) {
      console.error("Execution failed:", err);

      setRunResult({
        status: "FAILED",
        error: {
          message: err.message || "Execution failed",
        },
        finalOutput: null,
        tasks: {},
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Open execution report
  const handleOpenRunFromModal = (run) => {
    const runId = run?.id || run?.runId;

    if (runId) {
      if (onOpenReport) {
        onOpenReport(runId);
      } else {
        window.location.href = `/runs/${runId}`;
      }
    } else if (run) {
      setRunResult(run);
      setIsPastRunsDrawerOpen(true);
    }

    setIsWebhookModalOpen(false);
  };

  // Selected node
  const selectedNode =
    selectedElement?.type === "node"
      ? nodes.find(
        (node) => node.id === selectedElement.id
      )
      : null;

  const selectedMetadata = selectedNode
    ? catalogueMap[selectedNode.type]
    : null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,

        width: "100%",
        height: "auto",
        minHeight: 0,

        display: "flex",
        flexDirection: "column",
        overflow: "hidden",

        background: "var(--bg-main)",
        zIndex: 20,
      }}
    >
      {/* Top Action & Status Bar */}
      <div
        style={{
          height: "56px",
          flexShrink: 0,
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          zIndex: 25,
          gap: "12px",
        }}
      >
        {/* Left: Back, title and quick tools */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            minWidth: 0,
            flex: 1,
          }}
        >
          <button
            onClick={onBack}
            title="Back to workflows"
            style={{
              padding: "6px 12px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-full)",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontWeight: "600",
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={14} />
            Workflows
          </button>

          <button
            onClick={() =>
              setIsPaletteOpen((previous) => !previous)
            }
            title="Toggle Node Catalogue"
            style={{
              padding: "6px 10px",
              background: isPaletteOpen
                ? "var(--brand-light)"
                : "var(--bg-secondary)",
              border: `1px solid ${isPaletteOpen
                ? "var(--brand-border)"
                : "var(--border-subtle)"
                }`,
              borderRadius: "var(--radius-sm)",
              color: isPaletteOpen
                ? "var(--brand)"
                : "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <SidebarIcon size={16} />
          </button>

          <button
            onClick={handleOpenQuickAddFromToolbar}
            title="Add Node (Space or /)"
            style={{
              padding: "6px 12px",
              background: "var(--brand-light)",
              border: "1px solid var(--brand-border)",
              borderRadius: "var(--radius-sm)",
              color: "var(--brand)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.82rem",
              fontWeight: "700",
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
          >
            <Plus size={14} />
            Add Node
          </button>

          <button
            onClick={handleAutoLayout}
            title="Auto Align Graph (T)"
            style={{
              padding: "6px 10px",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.82rem",
              fontWeight: "600",
              flexShrink: 0,
            }}
          >
            <Wand2 size={14} color="var(--brand)" />
            Tidy
          </button>

          <div
            style={{
              width: "1px",
              height: "18px",
              background: "var(--border-subtle)",
              margin: "0 4px",
              flexShrink: 0,
            }}
          />

          {/* Workflow name and version */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              minWidth: 0,
              overflow: "hidden",
            }}
          >
            <input
              type="text"
              value={workflowName}
              onChange={(event) => {
                setWorkflowName(event.target.value);
                setIsDirty(true);
              }}
              aria-label="Workflow name"
              style={{
                background: "transparent",
                border: "none",
                borderBottom:
                  "1px dashed var(--border-medium)",
                color: "var(--text-primary)",
                fontSize: "1.02rem",
                fontWeight: "700",
                outline: "none",
                padding: "2px 4px",
                width: "200px",
                minWidth: 0,
              }}
            />

            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "10px",
                background: "var(--brand-light)",
                color: "var(--brand)",
                border: "1px solid var(--brand-border)",
                flexShrink: 0,
              }}
            >
              v{workflowVersion}
            </span>

            {nodes.filter(
              (node) => node.type === "trigger.manual"
            ).length >= 2 && (
                <span
                  title={`${nodes.filter(
                    (node) =>
                      node.type === "trigger.manual"
                  ).length
                    } manual triggers configured in graph`}
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: "700",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    background: "rgba(57, 174, 169, 0.15)",
                    color: "var(--brand)",
                    border: "1px solid var(--brand-border)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    flexShrink: 0,
                  }}
                >
                  <Zap size={11} />
                  {
                    nodes.filter(
                      (node) =>
                        node.type === "trigger.manual"
                    ).length
                  }{" "}
                  Triggers
                </span>
              )}

            {isDirty && (
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "#f59e0b",
                  whiteSpace: "nowrap",
                }}
              >
                • Unsaved
              </span>
            )}

            {saveSuccessMsg && (
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "#10b981",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                }}
              >
                <Check size={13} />
                {saveSuccessMsg}
              </span>
            )}
          </div>
        </div>

        {/* Right: Validation, save and run */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() =>
              setIsValidationDrawerOpen((previous) => !previous)
            }
            style={{
              padding: "6px 12px",
              borderRadius: "20px",
              fontSize: "0.78rem",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              background: validationResult.valid
                ? "rgba(16, 185, 129, 0.15)"
                : "rgba(244, 63, 94, 0.15)",
              color: validationResult.valid
                ? "#10b981"
                : "#f43f5e",
              border: `1px solid ${validationResult.valid
                ? "rgba(16, 185, 129, 0.3)"
                : "rgba(244, 63, 94, 0.4)"
                }`,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {isValidating ? (
              <Loader2
                size={13}
                className="animate-spin"
              />
            ) : validationResult.valid ? (
              <CheckCircle2 size={14} />
            ) : (
              <AlertCircle size={14} />
            )}

            <span>
              {isValidating
                ? "Validating..."
                : validationResult.valid
                  ? "Ready to Run"
                  : `${validationResult.errors.length} Issue${validationResult.errors.length !== 1
                    ? "s"
                    : ""
                  }`}
            </span>
          </button>

          <button
            onClick={() => setIsWebhookModalOpen(true)}
            title="Open Webhook Testing Panel"
            style={{
              padding: "6px 12px",
              background: isWebhookModalOpen
                ? "rgba(56, 189, 248, 0.18)"
                : "var(--bg-secondary)",
              border: `1px solid ${isWebhookModalOpen
                ? "#38bdf8"
                : "var(--border-subtle)"
                }`,
              borderRadius: "var(--radius-sm)",
              color: isWebhookModalOpen
                ? "#38bdf8"
                : "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.82rem",
              fontWeight: "600",
              flexShrink: 0,
            }}
          >
            <Radio size={14} color="#38bdf8" />
            Webhook
          </button>

          <button
            onClick={() =>
              setIsPastRunsDrawerOpen((previous) => !previous)
            }
            title="View Past Runs and Execution Reports"
            style={{
              padding: "6px 12px",
              background: isPastRunsDrawerOpen
                ? "rgba(57, 174, 169, 0.15)"
                : "var(--bg-secondary)",
              border: `1px solid ${isPastRunsDrawerOpen
                ? "var(--brand-border)"
                : "var(--border-subtle)"
                }`,
              borderRadius: "var(--radius-sm)",
              color: isPastRunsDrawerOpen
                ? "var(--brand)"
                : "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "0.82rem",
              fontWeight: "600",
              flexShrink: 0,
            }}
          >
            <History
              size={14}
              color={
                recentRuns.length > 0
                  ? "var(--brand)"
                  : "currentColor"
              }
            />

            <span>Past Runs</span>

            {recentRuns.length > 0 && (
              <span
                style={{
                  fontSize: "0.68rem",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  background: "rgba(57, 174, 169, 0.15)",
                  color: "var(--brand)",
                  fontWeight: "700",
                }}
              >
                {recentRuns.length}
              </span>
            )}
          </button>

          {/* Real-time CRDT WebSocket Status Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 10px",
              borderRadius: "var(--radius-full)",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.75rem",
              fontWeight: "600",
              color:
                connectionStatus === "connected"
                  ? "var(--accent-emerald)"
                  : connectionStatus === "connecting"
                  ? "var(--accent-amber)"
                  : "var(--text-muted)",
            }}
            title={`Collaboration WebSocket: ${connectionStatus}`}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background:
                  connectionStatus === "connected"
                    ? "#10b981"
                    : connectionStatus === "connecting"
                    ? "#f59e0b"
                    : "#6b7280",
                boxShadow:
                  connectionStatus === "connected"
                    ? "0 0 6px #10b981"
                    : "none",
              }}
            />
            <span>
              {connectionStatus === "connected"
                ? "Live"
                : connectionStatus === "connecting"
                ? "Syncing..."
                : "Offline"}
            </span>
          </div>

          {/* Active Collaborators Presence Cluster */}
          {collaborators.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginLeft: "-2px",
              }}
              title={`${collaborators.length} collaborator${collaborators.length > 1 ? "s" : ""} in room`}
            >
              {collaborators.slice(0, 4).map((c, idx) => {
                const initial = (c.user?.name || c.user?.email || "C")[0].toUpperCase();
                const color = c.user?.color || "#39AEA9";
                return (
                  <div
                    key={c.clientId || idx}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: color,
                      color: "#ffffff",
                      fontSize: "0.74rem",
                      fontWeight: "700",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "2px solid var(--bg-card)",
                      marginLeft: idx > 0 ? "-8px" : "0",
                      boxShadow: "var(--shadow-sm)",
                      zIndex: 5 + idx,
                    }}
                    title={`${c.user?.name || c.user?.email || "Collaborator"} (${c.user?.email || ""})`}
                  >
                    {initial}
                  </div>
                );
              })}
              {collaborators.length > 4 && (
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "var(--bg-chip)",
                    color: "var(--text-secondary)",
                    fontSize: "0.7rem",
                    fontWeight: "700",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid var(--bg-card)",
                    marginLeft: "-8px",
                    zIndex: 10,
                  }}
                >
                  +{collaborators.length - 4}
                </div>
              )}
            </div>
          )}

          {/* User Role Badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              borderRadius: "6px",
              fontSize: "0.72rem",
              fontWeight: "700",
              background:
                currentUserRole === "OWNER"
                  ? "rgba(16, 185, 129, 0.15)"
                  : currentUserRole === "EDITOR"
                  ? "rgba(59, 130, 246, 0.15)"
                  : "rgba(245, 158, 11, 0.15)",
              color:
                currentUserRole === "OWNER"
                  ? "var(--accent-emerald)"
                  : currentUserRole === "EDITOR"
                  ? "var(--accent-blue)"
                  : "var(--accent-amber)",
              border: `1px solid ${
                currentUserRole === "OWNER"
                  ? "rgba(16, 185, 129, 0.3)"
                  : currentUserRole === "EDITOR"
                  ? "rgba(59, 130, 246, 0.3)"
                  : "rgba(245, 158, 11, 0.3)"
              }`,
            }}
            title={`Your permission role: ${currentUserRole}`}
          >
            {currentUserRole === "OWNER" ? (
              <Shield size={12} />
            ) : currentUserRole === "EDITOR" ? (
              <Users size={12} />
            ) : (
              <Eye size={12} />
            )}
            <span>{currentUserRole}</span>
          </div>

          {/* Version History Button */}
          <button
            onClick={() => setIsVersionHistoryOpen(true)}
            title="Inspect and restore previous workflow versions"
            style={{
              padding: "6px 12px",
              background: isVersionHistoryOpen
                ? "rgba(57, 174, 169, 0.15)"
                : "var(--bg-secondary)",
              border: `1px solid ${
                isVersionHistoryOpen
                  ? "var(--brand-border)"
                  : "var(--border-subtle)"
              }`,
              borderRadius: "var(--radius-sm)",
              color: isVersionHistoryOpen
                ? "var(--brand)"
                : "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "0.82rem",
              fontWeight: "600",
              flexShrink: 0,
            }}
          >
            <History size={14} color="var(--brand)" />
            <span>Versions</span>
          </button>

          <button
            onClick={() => void handleSave()}
            disabled={isSaving || currentUserRole === "VIEWER"}
            title={
              currentUserRole === "VIEWER"
                ? "Viewers cannot save changes"
                : "Save workflow definition"
            }
            style={{
              padding: "7px 14px",
              background:
                currentUserRole === "VIEWER"
                  ? "var(--bg-chip)"
                  : isDirty
                  ? "var(--brand)"
                  : "var(--bg-secondary)",
              border: `1px solid ${
                currentUserRole === "VIEWER"
                  ? "var(--border-subtle)"
                  : isDirty
                  ? "var(--brand-border)"
                  : "var(--border-subtle)"
              }`,
              borderRadius: "var(--radius-sm)",
              color:
                currentUserRole === "VIEWER"
                  ? "var(--text-muted)"
                  : isDirty
                  ? "#ffffff"
                  : "var(--text-secondary)",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor:
                isSaving || currentUserRole === "VIEWER"
                  ? "not-allowed"
                  : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              boxShadow:
                isDirty && currentUserRole !== "VIEWER"
                  ? "0 0 14px var(--brand-glow)"
                  : "none",
              flexShrink: 0,
            }}
          >
            {isSaving ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : currentUserRole === "VIEWER" ? (
              <Lock size={14} />
            ) : (
              <Save size={14} />
            )}

            {isSaving ? "Saving..." : "Save"}
          </button>

          <button
            onClick={() => {
              if (currentUserRole === "VIEWER") {
                alert("Forbidden: Viewers cannot execute workflows.");
                return;
              }
              setIsRunModalOpen(true);
            }}
            disabled={currentUserRole === "VIEWER"}
            title={
              currentUserRole === "VIEWER"
                ? "Viewers cannot execute workflows"
                : "Run workflow"
            }
            className="btn btn-primary"
            style={{
              padding: "7px 18px",
              fontSize: "0.88rem",
              height: "36px",
              borderRadius: "var(--radius-full)",
              opacity: currentUserRole === "VIEWER" ? 0.45 : 1,
              cursor: currentUserRole === "VIEWER" ? "not-allowed" : "pointer",
              flexShrink: 0,
            }}
          >
            <Play size={14} fill={currentUserRole === "VIEWER" ? "none" : "#ffffff"} />
            Run
          </button>
        </div>
      </div>

      {/* Viewer Read-Only Banner */}
      {currentUserRole === "VIEWER" && (
        <div
          style={{
            background: "rgba(245, 158, 11, 0.12)",
            borderBottom: "1px solid rgba(245, 158, 11, 0.25)",
            padding: "6px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.8rem",
            color: "var(--accent-amber)",
            fontWeight: "600",
            zIndex: 22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Eye size={15} />
            <span>
              Viewer Mode (Read-Only) — You have view-only access to this workflow. Modifications and execution are restricted.
            </span>
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            Contact the workspace owner to request Editor access.
          </span>
        </div>
      )}

      {/* Main workspace */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <NodePalette
          catalogue={catalogue}
          onAddNode={(nodeMeta, customPos) =>
            handleAddNode(nodeMeta, customPos)
          }
          isOpen={isPaletteOpen}
          onToggle={() =>
            setIsPaletteOpen((previous) => !previous)
          }
        />

        {/* Canvas */}
        <div
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={() => {
            if (draggingNodeId) {
              setDraggingNodeId(null);
            }

            if (isPanning) {
              setIsPanning(false);
            }
          }}
          onDoubleClick={handleCanvasDoubleClick}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          className="workflow-canvas-grid"
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            position: "relative",
            overflow: "hidden",
            cursor: isPanning ? "grabbing" : "default",
          }}
        >
          {/* Connection mode banner */}
          {connectingSource && (
            <div
              style={{
                position: "absolute",
                top: "16px",
                left: "50%",
                transform: "translateX(-50%)",
                background: "var(--bg-card)",
                border: "1.5px solid var(--brand)",
                boxShadow: "0 10px 30px var(--brand-glow)",
                borderRadius: "20px",
                padding: "8px 18px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                zIndex: 35,
                fontSize: "0.82rem",
                fontWeight: "600",
                color: "var(--text-primary)",
                maxWidth: "90%",
              }}
            >
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "var(--brand)",
                  flexShrink: 0,
                }}
              />

              <span>
                Connecting from{" "}
                <strong style={{ color: "var(--brand)" }}>
                  {connectingSource.nodeId} ·{" "}
                  {connectingSource.portName}
                </strong>{" "}
                → Click an input port on any node (or release on
                canvas to pick a new node)
              </span>

              <button
                onClick={() => {
                  setConnectingSource(null);
                  setConnectingMousePos(null);
                }}
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  borderRadius: "10px",
                  padding: "3px 10px",
                  fontSize: "0.72rem",
                  fontWeight: "700",
                  flexShrink: 0,
                }}
              >
                Cancel (Esc)
              </button>
            </div>
          )}

          {/* Quick-start guide */}
          {nodes.length <= 1 && (
            <div
              style={{
                position: "absolute",
                bottom: "24px",
                left: "24px",
                maxWidth: "400px",
                background: "var(--bg-card)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid var(--border-medium)",
                borderRadius: "var(--radius-md)",
                padding: "16px",
                boxShadow: "var(--shadow-lg)",
                zIndex: 15,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <Sparkles size={16} color="var(--brand)" />

                <span
                  style={{
                    fontSize: "0.88rem",
                    fontWeight: "700",
                    color: "var(--text-primary)",
                  }}
                >
                  Quick Start Guide
                </span>
              </div>

              <p
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-secondary)",
                  lineHeight: 1.4,
                  margin: 0,
                }}
              >
                Double-click anywhere to add nodes, or drag
                from the green output port to connect nodes
                together.
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  marginTop: "4px",
                }}
              >
                {[
                  {
                    type: "math.multiply",
                    label: "+ Add Math Multiply",
                  },
                  {
                    type: "json.parse",
                    label: "+ Add JSON Parser",
                  },
                  {
                    type: "output.return",
                    label: "+ Add Return Output",
                  },
                ].map((item) => (
                  <button
                    key={item.type}
                    onClick={() => {
                      const catalogueNode =
                        catalogueMap[item.type];

                      if (!catalogueNode) {
                        return;
                      }

                      const source = nodes[0]
                        ? {
                          nodeId: nodes[0].id,
                          portName: "output",
                        }
                        : null;

                      const x = nodes[0]
                        ? nodes[0].position.x + 320
                        : 400;

                      const y = nodes[0]
                        ? nodes[0].position.y
                        : 180;

                      handleAddNode(
                        catalogueNode,
                        { x, y },
                        source
                      );
                    }}
                    className="btn btn-secondary"
                    style={{
                      padding: "5px 12px",
                      fontSize: "0.75rem",
                      borderRadius: "12px",
                      fontWeight: "600",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Viewport controls */}
          <div
            style={{
              position: "absolute",
              bottom: "20px",
              right: selectedNode ? "340px" : "20px",
              background: "var(--bg-card)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              zIndex: 20,
              boxShadow: "var(--shadow-md)",
              transition: "right 0.2s ease",
            }}
          >
            <button
              onClick={() =>
                setScale((previous) =>
                  Math.min(previous * 1.15, 2.2)
                )
              }
              title="Zoom In"
              style={{
                padding: "6px",
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                borderRadius: "6px",
              }}
            >
              <ZoomIn size={16} />
            </button>

            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                minWidth: "38px",
                textAlign: "center",
              }}
            >
              {Math.round(scale * 100)}%
            </span>

            <button
              onClick={() =>
                setScale((previous) =>
                  Math.max(previous * 0.85, 0.4)
                )
              }
              title="Zoom Out"
              style={{
                padding: "6px",
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                borderRadius: "6px",
              }}
            >
              <ZoomOut size={16} />
            </button>

            <div
              style={{
                width: "1px",
                height: "14px",
                background: "var(--border-subtle)",
              }}
            />

            <button
              onClick={handleAutoLayout}
              title="Tidy Graph (T)"
              style={{
                padding: "6px",
                background: "none",
                border: "none",
                color: "var(--brand)",
                cursor: "pointer",
                borderRadius: "6px",
              }}
            >
              <Wand2 size={16} />
            </button>

            <button
              onClick={() => {
                setScale(1);
                setPan({ x: 80, y: 60 });
              }}
              title="Reset View"
              style={{
                padding: "6px",
                background: "none",
                border: "none",
                color: "var(--text-secondary)",
                cursor: "pointer",
                borderRadius: "6px",
              }}
            >
              <Maximize2 size={16} />
            </button>
          </div>

          {/* Transformed canvas contents */}
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              height: "100%",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: "0 0",
              pointerEvents: "none",
            }}
          >
            {/* Connection SVG layer */}
            <svg
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: "6000px",
                height: "6000px",
                pointerEvents: "auto",
                overflow: "visible",
              }}
            >
              {edges.map((edge) => {
                const sourceNode = nodes.find(
                  (node) => node.id === edge.source
                );

                const targetNode = nodes.find(
                  (node) => node.id === edge.target
                );

                const isEdgeSelected =
                  selectedElement?.type === "edge" &&
                  selectedElement.id === edge.id;

                const isEdgeInCycle = (edgeItem, cycle) => {
                  if (
                    !Array.isArray(cycle) ||
                    cycle.length < 2
                  ) {
                    return false;
                  }

                  for (
                    let index = 0;
                    index < cycle.length - 1;
                    index++
                  ) {
                    if (
                      cycle[index] === edgeItem.source &&
                      cycle[index + 1] === edgeItem.target
                    ) {
                      return true;
                    }
                  }

                  return false;
                };

                const edgeHasError =
                  validationResult.errors.some(
                    (error) =>
                      error.edgeId === edge.id ||
                      (error.code === "CYCLE_DETECTED" &&
                        isEdgeInCycle(edge, error.cycle))
                  );

                return (
                  <EdgePath
                    key={edge.id}
                    edge={edge}
                    sourceNode={sourceNode}
                    targetNode={targetNode}
                    sourceMetadata={
                      sourceNode
                        ? catalogueMap[sourceNode.type]
                        : null
                    }
                    targetMetadata={
                      targetNode
                        ? catalogueMap[targetNode.type]
                        : null
                    }
                    isSelected={isEdgeSelected}
                    onSelect={(id) =>
                      setSelectedElement({
                        id,
                        type: "edge",
                      })
                    }
                    onDelete={handleDeleteEdge}
                    hasError={edgeHasError}
                    isRunning={isRunning}
                    executionTasks={runResult?.tasks}
                  />
                );
              })}

              {/* Active connection */}
              {connectingSource && connectingMousePos &&
                (() => {
                  const sourceNode = nodes.find(
                    (node) =>
                      node.id === connectingSource.nodeId
                  );

                  const sourceMetadata = sourceNode
                    ? catalogueMap[sourceNode.type]
                    : null;

                  if (!sourceNode) {
                    return null;
                  }

                  const start = calculatePortPosition(
                    sourceNode,
                    connectingSource.portName,
                    "output",
                    sourceMetadata
                  );

                  const path = generateBezierPath(
                    start.x,
                    start.y,
                    connectingMousePos.x,
                    connectingMousePos.y
                  );

                  return (
                    <path
                      d={path}
                      fill="none"
                      stroke="var(--brand)"
                      strokeWidth="2.5"
                      strokeDasharray="6, 6"
                      style={{
                        pointerEvents: "none",
                      }}
                    />
                  );
                })()}
            </svg>

            {/* Node layer */}
            <div style={{ pointerEvents: "auto" }}>
              {nodes.map((node) => {
                const isNodeSelected =
                  selectedElement?.type === "node" &&
                  selectedElement.id === node.id;

                const metadata = catalogueMap[node.type];

                const task = runResult?.tasks
                  ? runResult.tasks[node.id]
                  : null;

                return (
                  <NodeCard
                    key={node.id}
                    node={node}
                    metadata={metadata}
                    isSelected={isNodeSelected}
                    onSelect={(id) =>
                      setSelectedElement({
                        id,
                        type: "node",
                      })
                    }
                    onDelete={handleDeleteNode}
                    onStartDrag={handleStartDragNode}
                    onStartConnection={handleStartConnection}
                    onCompleteConnection={
                      handleCompleteConnection
                    }
                    onQuickConnect={handleQuickConnect}
                    errors={validationResult.errors}
                    executionTask={task}
                    isConnecting={Boolean(connectingSource)}
                    connectingSourceNodeId={
                      connectingSource?.nodeId
                    }
                    collaboratorSelection={remoteSelectedNodes[node.id] || null}
                    readOnly={currentUserRole === "VIEWER"}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Node inspector */}
        {selectedNode && (
          <NodeInspector
            selectedNode={selectedNode}
            metadata={selectedMetadata}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onClose={() => setSelectedElement(null)}
            errors={validationResult.errors}
            executionTask={
              runResult?.tasks
                ? runResult.tasks[selectedNode.id]
                : null
            }
            readOnly={currentUserRole === "VIEWER"}
          />
        )}
      </div>

      {/* Quick Add popover */}
      <QuickAddPopover
        isOpen={quickAdd.isOpen}
        onClose={() =>
          setQuickAdd((previous) => ({
            ...previous,
            isOpen: false,
            autoConnectSource: null,
          }))
        }
        position={quickAdd}
        catalogue={catalogue}
        autoConnectSource={quickAdd.autoConnectSource}
        onSelectNode={(
          nodeMeta,
          customPos,
          autoConnectSource
        ) => {
          handleAddNode(
            nodeMeta,
            customPos,
            autoConnectSource
          );
        }}
      />

      {/* Validation drawer */}
      <ValidationDrawer
        isOpen={isValidationDrawerOpen}
        onClose={() => setIsValidationDrawerOpen(false)}
        validationResult={validationResult}
        onSelectElement={(id, type) => {
          setSelectedElement({ id, type });

          const targetNode = nodes.find(
            (node) => node.id === id
          );

          if (targetNode) {
            setPan({
              x: -targetNode.position.x * scale + 200,
              y: -targetNode.position.y * scale + 200,
            });
          }
        }}
      />

      {/* Execution modal */}
      <RunExecutionModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        workflow={{
          ...workflow,
          name: workflowName,
          version: workflowVersion,
          nodes,
          edges,
        }}
        onRun={handleExecuteRun}
        isRunning={isRunning}
        runResult={runResult}
      />

      {/* Webhook testing modal */}
      <WebhookTestingModal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
        workflowId={workflowId}
        workflowName={workflowName}
        onOpenRun={handleOpenRunFromModal}
        onOpenReport={onOpenReport}
      />

      {/* Past runs drawer */}
      <PastRunsDrawer
        isOpen={isPastRunsDrawerOpen}
        onClose={() => setIsPastRunsDrawerOpen(false)}
        workflowId={workflowId}
        workflowName={workflowName}
        recentRuns={recentRuns}
        isLoadingHistory={isLoadingHistory}
        onRefresh={() => fetchRecentRuns(workflowId)}
        onOpenReport={onOpenReport}
      />

      {/* Version history drawer */}
      <VersionHistoryDrawer
        isOpen={isVersionHistoryOpen}
        onClose={() => setIsVersionHistoryOpen(false)}
        workflowId={workflowId}
        currentVersion={workflowVersion}
        userRole={currentUserRole}
        onRestoreVersion={handleRestoreVersion}
      />
    </div>
  );
}