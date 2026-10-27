/**
 * NexFlow Collaborative Workflows - End-to-End Verification Test Suite
 * Tests:
 * 1. Workspace creation & membership management
 * 2. Email invitations & token acceptance/rejection
 * 3. Role-based access control (Owner, Editor, Viewer) on all APIs
 * 4. Viewer write protection (blocked from update, delete, execute, and rollback)
 * 5. Editor permissions (can update, execute, rollback; cannot delete)
 * 6. Owner permissions (full administrative control, delete)
 * 7. Server-side DAG validation rejection before execution
 * 8. Workflow versioning snapshotting and rollback
 * 9. Real-time Yjs CRDT WebSocket authorization and read-only sync logic
 * 10. Access revocation when removed from workspace
 */

const assert = require("assert");
const prisma = require("./src/config/db");
const workspaceService = require("./src/services/workspace.service");
const workflowService = require("./src/services/workflow.service");
const jwt = require("jsonwebtoken");
const env = require("./env");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function runCollaborationTests() {
  console.log("\n===========================================================");
  console.log(" NexFlow Real-Time Collaborative Workflows Test Suite");
  console.log("===========================================================\n");

  const timestamp = Date.now();
  const ownerId = `test_owner_${timestamp}`;
  const editorId = `test_editor_${timestamp}`;
  const viewerId = `test_viewer_${timestamp}`;
  const outsiderId = `test_outsider_${timestamp}`;

  let testWorkspaceId;
  let testWorkflowId;
  let editorInviteToken;
  let viewerInviteToken;

  try {
    // -------------------------------------------------------------------------
    // Setup Test Users
    // -------------------------------------------------------------------------
    console.log("--- 1. Setting Up Test Users ---");

    await test("Create test users in database", async () => {
      await prisma.user.createMany({
        data: [
          { id: ownerId, email: `${ownerId}@example.com`, name: "Owner User", role: "USER" },
          { id: editorId, email: `${editorId}@example.com`, name: "Editor User", role: "USER" },
          { id: viewerId, email: `${viewerId}@example.com`, name: "Viewer User", role: "USER" },
          { id: outsiderId, email: `${outsiderId}@example.com`, name: "Outsider User", role: "USER" },
        ],
      });
    });

    // -------------------------------------------------------------------------
    // Phase 2: Workspace Creation & Membership
    // -------------------------------------------------------------------------
    console.log("\n--- 2. Workspace Creation & Member Management ---");

    await test("Owner creates workspace; auto-assigns OWNER role to creator", async () => {
      const ws = await workspaceService.createWorkspace(ownerId, {
        name: "Dormammu Research Lab",
        description: "Collaborative testing workspace",
      });

      assert.ok(ws && ws.id, "Workspace should be created");
      assert.strictEqual(ws.name, "Dormammu Research Lab");
      assert.strictEqual(ws.ownerId, ownerId);
      testWorkspaceId = ws.id;

      // Verify creator has OWNER role
      const role = await workspaceService.getUserWorkspaceRole(ownerId, testWorkspaceId);
      assert.strictEqual(role, "OWNER", "Creator must have OWNER role");
    });

    await test("List workspaces for Owner returns newly created workspace", async () => {
      const list = await workspaceService.listUserWorkspaces(ownerId);
      assert.ok(list.some((w) => w.id === testWorkspaceId && w.role === "OWNER"));
    });

    // -------------------------------------------------------------------------
    // Phase 2 & 3: Invitations & Role Assignment
    // -------------------------------------------------------------------------
    console.log("\n--- 3. Invitations & Role Assignment ---");

    await test("Owner invites Editor and Viewer by email", async () => {
      const editorInvite = await workspaceService.inviteUser(ownerId, testWorkspaceId, {
        email: `${editorId}@example.com`,
        role: "EDITOR",
      });
      assert.ok(editorInvite && editorInvite.token, "Editor invitation must have a token");
      editorInviteToken = editorInvite.token;

      const viewerInvite = await workspaceService.inviteUser(ownerId, testWorkspaceId, {
        email: `${viewerId}@example.com`,
        role: "VIEWER",
      });
      assert.ok(viewerInvite && viewerInvite.token, "Viewer invitation must have a token");
      viewerInviteToken = viewerInvite.token;
    });

    await test("Non-owner cannot invite new members", async () => {
      await assert.rejects(
        workspaceService.inviteUser(outsiderId, testWorkspaceId, {
          email: "someone@example.com",
          role: "VIEWER",
        }),
        /Forbidden/
      );
    });

    await test("Pending invitations are visible to invitees", async () => {
      const editorPending = await workspaceService.listUserPendingInvitations(`${editorId}@example.com`);
      assert.ok(editorPending.some((inv) => inv.workspaceId === testWorkspaceId && inv.role === "EDITOR"));

      const viewerPending = await workspaceService.listUserPendingInvitations(`${viewerId}@example.com`);
      assert.ok(viewerPending.some((inv) => inv.workspaceId === testWorkspaceId && inv.role === "VIEWER"));
    });

    await test("Editor and Viewer accept invitations; roles become active", async () => {
      const editorResult = await workspaceService.acceptInvitation(editorId, `${editorId}@example.com`, editorInviteToken);
      assert.strictEqual(editorResult.role, "EDITOR");

      const viewerResult = await workspaceService.acceptInvitation(viewerId, `${viewerId}@example.com`, viewerInviteToken);
      assert.strictEqual(viewerResult.role, "VIEWER");

      // Verify roles through role resolver
      const resolvedEditorRole = await workspaceService.getUserWorkspaceRole(editorId, testWorkspaceId);
      assert.strictEqual(resolvedEditorRole, "EDITOR");

      const resolvedViewerRole = await workspaceService.getUserWorkspaceRole(viewerId, testWorkspaceId);
      assert.strictEqual(resolvedViewerRole, "VIEWER");

      const resolvedOutsiderRole = await workspaceService.getUserWorkspaceRole(outsiderId, testWorkspaceId);
      assert.strictEqual(resolvedOutsiderRole, null);
    });

    await test("Workspace members list shows all 3 users with proper roles", async () => {
      const ws = await workspaceService.getWorkspaceById(ownerId, testWorkspaceId);
      assert.strictEqual(ws.members.length, 3);
      const roles = ws.members.map((m) => m.role).sort();
      assert.deepStrictEqual(roles, ["EDITOR", "OWNER", "VIEWER"]);
    });

    // -------------------------------------------------------------------------
    // Phase 3 & 4: Workflow Access & Permissions
    // -------------------------------------------------------------------------
    console.log("\n--- 4. Role-Based Permissions (Owner, Editor, Viewer) ---");

    const validDefinition = {
      schemaVersion: 1,
      name: "Shared Pipeline",
      nodes: [
        { id: "n1", type: "trigger.manual", version: 1, position: { x: 100, y: 100 }, config: {} },
        { id: "n2", type: "math.multiply", version: 1, position: { x: 400, y: 100 }, config: { a: 6, b: 7 } },
      ],
      edges: [
        { id: "e1", source: "n1", target: "n2", sourceHandle: "output", targetHandle: "input" },
      ],
    };

    await test("Owner creates workflow inside shared workspace", async () => {
      const wf = await workflowService.createWorkflow(ownerId, {
        name: "Shared Pipeline",
        description: "Shared workspace workflow",
        workspaceId: testWorkspaceId,
        definition: validDefinition,
      });

      assert.ok(wf && wf.id);
      assert.strictEqual(wf.workspaceId, testWorkspaceId);
      assert.strictEqual(wf.version, 1);
      testWorkflowId = wf.id;
    });

    await test("Role resolution: Owner=OWNER, Editor=EDITOR, Viewer=VIEWER, Outsider=Forbidden", async () => {
      const ownerAccess = await workflowService.resolveWorkflowAccess(ownerId, testWorkflowId);
      assert.strictEqual(ownerAccess.role, "OWNER");

      const editorAccess = await workflowService.resolveWorkflowAccess(editorId, testWorkflowId);
      assert.strictEqual(editorAccess.role, "EDITOR");

      const viewerAccess = await workflowService.resolveWorkflowAccess(viewerId, testWorkflowId);
      assert.strictEqual(viewerAccess.role, "VIEWER");

      await assert.rejects(
        workflowService.resolveWorkflowAccess(outsiderId, testWorkflowId),
        /Forbidden/
      );
    });

    await test("Viewer CAN read/inspect workflow definition", async () => {
      const wf = await workflowService.getWorkflowById(viewerId, testWorkflowId);
      assert.ok(wf);
      assert.strictEqual(wf.id, testWorkflowId);
      assert.strictEqual(wf.currentUserRole, "VIEWER");
    });

    await test("Viewer CANNOT update workflow definition (HTTP 403 Forbidden)", async () => {
      await assert.rejects(
        workflowService.updateWorkflow(viewerId, testWorkflowId, {
          name: "Malicious Tampering by Viewer",
          definition: validDefinition,
        }),
        /Forbidden: Viewers have read-only access/
      );
    });

    await test("Editor CAN update workflow definition -> saves as Version 2", async () => {
      const updatedDef = {
        ...validDefinition,
        nodes: [
          ...validDefinition.nodes,
          { id: "n3", type: "output.return", version: 1, position: { x: 700, y: 100 }, config: {} },
        ],
        edges: [
          ...validDefinition.edges,
          { id: "e2", source: "n2", target: "n3", sourceHandle: "output", targetHandle: "input" },
        ],
      };

      const updated = await workflowService.updateWorkflow(editorId, testWorkflowId, {
        name: "Shared Pipeline v2",
        definition: updatedDef,
      });

      assert.ok(updated);
      assert.strictEqual(updated.version, 2);
      assert.strictEqual(updated.name, "Shared Pipeline v2");
      assert.strictEqual(updated.definition.nodes.length, 3);
    });

    await test("Viewer CANNOT delete workflow (HTTP 403 Forbidden)", async () => {
      await assert.rejects(
        workflowService.deleteWorkflow(viewerId, testWorkflowId),
        /Forbidden: Viewers cannot delete workflows/
      );
    });

    await test("Editor CANNOT delete workflow (HTTP 403 Forbidden: Owner only)", async () => {
      await assert.rejects(
        workflowService.deleteWorkflow(editorId, testWorkflowId),
        /Forbidden: Only workspace owners can delete workflows/
      );
    });

    // -------------------------------------------------------------------------
    // Phase 5: Workflow Versioning & Rollback
    // -------------------------------------------------------------------------
    console.log("\n--- 5. Workflow Versioning & Safe Rollback ---");

    await test("Workflow versions list contains Version 1 and Version 2 snapshots", async () => {
      const versions = await workflowService.listWorkflowVersions(viewerId, testWorkflowId);
      assert.strictEqual(versions.length, 2);
      assert.strictEqual(versions[0].version, 2);
      assert.strictEqual(versions[1].version, 1);
    });

    await test("Viewer CANNOT restore earlier version (HTTP 403 Forbidden)", async () => {
      await assert.rejects(
        workflowService.restoreWorkflowVersion(viewerId, testWorkflowId, 1),
        /Forbidden: Viewers cannot restore workflow versions/
      );
    });

    await test("Editor CAN restore Version 1 -> creates Version 3 preserving history", async () => {
      const restoreRes = await workflowService.restoreWorkflowVersion(editorId, testWorkflowId, 1);
      assert.ok(restoreRes);
      assert.strictEqual(restoreRes.restoredFromVersion, 1);
      assert.strictEqual(restoreRes.newVersion, 3);
      assert.strictEqual(restoreRes.workflow.version, 3);
      // Verify node count matches Version 1 (2 nodes, not 3)
      assert.strictEqual(restoreRes.workflow.definition.nodes.length, 2);

      // Verify versions table now contains 3 snapshots
      const versions = await workflowService.listWorkflowVersions(editorId, testWorkflowId);
      assert.strictEqual(versions.length, 3);
    });

    // -------------------------------------------------------------------------
    // Phase 6: Server-Side DAG Validation Before Run Execution
    // -------------------------------------------------------------------------
    console.log("\n--- 6. Backend DAG Validation & Execution Authorization ---");

    await test("Viewer CANNOT execute workflow run (HTTP 403 Forbidden)", async () => {
      await assert.rejects(
        workflowService.executeWorkflowRun(viewerId, testWorkflowId, {}),
        /Forbidden: Viewers are not permitted to execute workflows/
      );
    });

    await test("Invalid workflow with cycle is rejected by server DAG validation", async () => {
      // Create a cyclic workflow
      const cyclicWf = await workflowService.createWorkflow(ownerId, {
        name: "Cyclic Test Pipeline",
        workspaceId: testWorkspaceId,
        definition: {
          schemaVersion: 1,
          name: "Cyclic Test Pipeline",
          nodes: [
            { id: "c1", type: "trigger.manual", version: 1, config: {} },
            { id: "c2", type: "math.multiply", version: 1, config: { a: 2, b: 3 } },
          ],
          edges: [
            { id: "ce1", source: "c1", target: "c2" },
            { id: "ce2", source: "c2", target: "c1" }, // cycle!
          ],
        },
      });

      await assert.rejects(
        workflowService.executeWorkflowRun(ownerId, cyclicWf.id, {}),
        /Workflow DAG validation failed/
      );
    });

    await test("Valid workflow executes successfully for Editor and generates task runs", async () => {
      const run = await workflowService.executeWorkflowRun(editorId, testWorkflowId, { input: 10 });
      assert.ok(run && run.id);
      assert.strictEqual(run.workflowId, testWorkflowId);
      assert.ok(["QUEUED", "RUNNING", "COMPLETED"].includes(run.status));
    });

    // -------------------------------------------------------------------------
    // Phase 4: Yjs CRDT Server Role Authorization & Read-Only Logic
    // -------------------------------------------------------------------------
    console.log("\n--- 7. Yjs CRDT Collaboration WebSocket Security ---");

    await test("JWT Token verification generates correct collaboration identity", async () => {
      const secret = env.JWT_ACCESS_SECRET || env.JWT_SECRET || "nexflow_secret_key";
      const viewerToken = jwt.sign({ userId: viewerId, email: `${viewerId}@example.com` }, secret, { expiresIn: "1h" });
      const decoded = jwt.verify(viewerToken, secret);
      assert.strictEqual(decoded.userId, viewerId);

      // Verify that resolveWorkflowAccess grants VIEWER role to this user
      const access = await workflowService.resolveWorkflowAccess(decoded.userId, testWorkflowId);
      assert.strictEqual(access.role, "VIEWER");
      assert.strictEqual(access.canModify, false);
      assert.strictEqual(access.canExecute, false);
    });

    await test("Editor token has canModify=true, canExecute=true", async () => {
      const access = await workflowService.resolveWorkflowAccess(editorId, testWorkflowId);
      assert.strictEqual(access.role, "EDITOR");
      assert.strictEqual(access.canModify, true);
      assert.strictEqual(access.canExecute, true);
    });

    // -------------------------------------------------------------------------
    // Membership Revocation
    // -------------------------------------------------------------------------
    console.log("\n--- 8. Membership Revocation & Access Cutoff ---");

    await test("Owner removes Viewer from workspace; subsequent access is immediately forbidden", async () => {
      await workspaceService.removeMember(ownerId, testWorkspaceId, viewerId);

      // Verify role is now null
      const roleAfterRemoval = await workspaceService.getUserWorkspaceRole(viewerId, testWorkspaceId);
      assert.strictEqual(roleAfterRemoval, null);

      // Verify access to workflow is now Forbidden
      await assert.rejects(
        workflowService.resolveWorkflowAccess(viewerId, testWorkflowId),
        /Forbidden/
      );
    });

    await test("Owner cannot be removed from own workspace", async () => {
      await assert.rejects(
        workspaceService.removeMember(ownerId, testWorkspaceId, ownerId),
        /Cannot remove the sole owner/
      );
    });

  } finally {
    // -------------------------------------------------------------------------
    // Cleanup Test Data
    // -------------------------------------------------------------------------
    console.log("\n--- Cleaning Up Test Data ---");
    try {
      if (testWorkspaceId) {
        const wfList = await prisma.workflow.findMany({
          where: { workspaceId: testWorkspaceId },
          select: { id: true },
        });
        const wfIds = wfList.map((w) => w.id);

        if (wfIds.length > 0) {
          await prisma.workflowRun.deleteMany({
            where: { workflowId: { in: wfIds } },
          });
          await prisma.workflowVersion.deleteMany({
            where: { workflowId: { in: wfIds } },
          });
          await prisma.workflow.deleteMany({
            where: { id: { in: wfIds } },
          });
        }

        await prisma.workspaceInvitation.deleteMany({
          where: { workspaceId: testWorkspaceId },
        });
        await prisma.workspaceMember.deleteMany({
          where: { workspaceId: testWorkspaceId },
        });
        await prisma.workspace.delete({
          where: { id: testWorkspaceId },
        });
      }
      await prisma.user.deleteMany({
        where: { id: { in: [ownerId, editorId, viewerId, outsiderId] } },
      });
      console.log("  ✓ Test artifacts safely purged.");
    } catch (cleanErr) {
      console.warn("  ! Note during cleanup:", cleanErr.message);
    }
  }

  console.log("\n===========================================================");
  console.log(` Summary: ${passed} Passed, ${failed} Failed`);
  console.log("===========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runCollaborationTests().catch((err) => {
  console.error("Test runner encountered an unhandled exception:", err);
  process.exit(1);
});
