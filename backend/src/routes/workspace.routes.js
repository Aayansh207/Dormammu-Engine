const express = require("express");
const { requireAuth } = require("../middleware/auth.middleware");
const workspaceController = require("../controllers/workspace.controller");

const router = express.Router();

router.use(requireAuth);

// Workspace CRUD
router.post("/", workspaceController.createWorkspace);
router.get("/", workspaceController.listWorkspaces);
router.get("/invitations/me", workspaceController.listUserInvitations);
router.post("/invitations/accept", workspaceController.acceptInvitation);
router.post("/invitations/reject", workspaceController.rejectInvitation);

router.get("/:id", workspaceController.getWorkspace);
router.put("/:id", workspaceController.updateWorkspace);
router.delete("/:id", workspaceController.deleteWorkspace);

// Workflows in workspace
router.get("/:id/workflows", workspaceController.listWorkspaceWorkflows);

// Invitations & Membership management
router.post("/:id/invitations", workspaceController.inviteMember);
router.get("/:id/invitations", workspaceController.listInvitations);
router.delete("/:id/invitations/:invitationId", workspaceController.revokeInvitation);

router.delete("/:id/members/:memberUserId", workspaceController.removeMember);
router.patch("/:id/members/:memberUserId/role", workspaceController.updateMemberRole);

module.exports = router;
