const workspaceService = require("../services/workspace.service");

class WorkspaceController {
  async createWorkspace(req, res, next) {
    try {
      const userId = req.user.id;
      const { name, description } = req.body;
      const workspace = await workspaceService.createWorkspace(userId, { name, description });
      return res.status(201).json({
        success: true,
        data: workspace,
      });
    } catch (err) {
      next(err);
    }
  }

  async listWorkspaces(req, res, next) {
    try {
      const userId = req.user.id;
      const workspaces = await workspaceService.listUserWorkspaces(userId);
      return res.status(200).json({
        success: true,
        data: workspaces,
      });
    } catch (err) {
      next(err);
    }
  }

  async getWorkspace(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const workspace = await workspaceService.getWorkspace(userId, id);
      return res.status(200).json({
        success: true,
        data: workspace,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateWorkspace(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { name, description } = req.body;
      const updated = await workspaceService.updateWorkspace(userId, id, { name, description });
      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteWorkspace(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const result = await workspaceService.deleteWorkspace(userId, id);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  async inviteMember(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { email, role } = req.body;
      const invitation = await workspaceService.inviteUser(userId, id, { email, role });
      return res.status(201).json({
        success: true,
        message: `Invitation sent to ${email}`,
        data: invitation,
      });
    } catch (err) {
      next(err);
    }
  }

  async listInvitations(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const invitations = await workspaceService.listWorkspaceInvitations(userId, id);
      return res.status(200).json({
        success: true,
        data: invitations,
      });
    } catch (err) {
      next(err);
    }
  }

  async revokeInvitation(req, res, next) {
    try {
      const userId = req.user.id;
      const { id, invitationId } = req.params;
      const result = await workspaceService.revokeInvitation(userId, id, invitationId);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  async listUserInvitations(req, res, next) {
    try {
      const userEmail = req.user.email;
      const invitations = await workspaceService.listUserPendingInvitations(userEmail);
      return res.status(200).json({
        success: true,
        data: invitations,
      });
    } catch (err) {
      next(err);
    }
  }

  async acceptInvitation(req, res, next) {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const { token } = req.body;
      const result = await workspaceService.acceptInvitation(userId, userEmail, token);
      return res.status(200).json({
        success: true,
        message: "Successfully joined workspace",
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async rejectInvitation(req, res, next) {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const { token } = req.body;
      const result = await workspaceService.rejectInvitation(userId, userEmail, token);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  async removeMember(req, res, next) {
    try {
      const userId = req.user.id;
      const { id, memberUserId } = req.params;
      const result = await workspaceService.removeMember(userId, id, memberUserId);
      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateMemberRole(req, res, next) {
    try {
      const userId = req.user.id;
      const { id, memberUserId } = req.params;
      const { role } = req.body;
      const result = await workspaceService.updateMemberRole(userId, id, memberUserId, role);
      return res.status(200).json({
        success: true,
        data: result.member,
      });
    } catch (err) {
      next(err);
    }
  }

  async listWorkspaceWorkflows(req, res, next) {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const workflows = await workspaceService.listWorkspaceWorkflows(userId, id);
      return res.status(200).json({
        success: true,
        data: workflows,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WorkspaceController();
