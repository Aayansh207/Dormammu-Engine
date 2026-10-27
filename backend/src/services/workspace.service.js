const crypto = require("crypto");
const prisma = require("../config/db");
const mailService = require("./mail.service");

class WorkspaceService {
  /**
   * Determine the user's role in a workspace
   * Returns 'OWNER' | 'EDITOR' | 'VIEWER' | null
   */
  async getUserWorkspaceRole(userId, workspaceId) {
    if (!userId || !workspaceId) return null;

    const member = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (member) return member.role;

    // Check if user is direct owner of the workspace
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    });

    if (ws && ws.ownerId === userId) {
      return "OWNER";
    }

    return null;
  }

  /**
   * Create a new workspace and automatically register creator as OWNER
   */
  async createWorkspace(userId, { name, description = "" }) {
    if (!name || !name.trim()) {
      const err = new Error("Workspace name is required");
      err.statusCode = 400;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: name.trim(),
          description: description ? description.trim() : null,
          ownerId: userId,
        },
      });

      // Add creator as OWNER member
      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          userId,
          role: "OWNER",
        },
      });

      return {
        ...workspace,
        role: "OWNER",
        membersCount: 1,
        workflowsCount: 0,
      };
    });
  }

  /**
   * List all workspaces the user has access to
   */
  async listUserWorkspaces(userId) {
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            owner: {
              select: { id: true, name: true, email: true, profilePhoto: true },
            },
            _count: {
              select: {
                members: true,
                workflows: true,
              },
            },
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      description: m.workspace.description,
      ownerId: m.workspace.ownerId,
      owner: m.workspace.owner,
      role: m.role,
      joinedAt: m.joinedAt,
      createdAt: m.workspace.createdAt,
      updatedAt: m.workspace.updatedAt,
      membersCount: m.workspace._count.members,
      workflowsCount: m.workspace._count.workflows,
    }));
  }

  /**
   * Get workspace details, members, and pending invitations (for owners)
   */
  async getWorkspace(userId, workspaceId) {
    const role = await this.getUserWorkspaceRole(userId, workspaceId);
    if (!role) {
      const err = new Error("Forbidden: You do not have access to this workspace");
      err.statusCode = 403;
      throw err;
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          select: { id: true, name: true, email: true, profilePhoto: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, profilePhoto: true },
            },
          },
          orderBy: { joinedAt: "asc" },
        },
        _count: {
          select: {
            members: true,
            workflows: true,
          },
        },
      },
    });

    if (!workspace) {
      const err = new Error("Workspace not found");
      err.statusCode = 404;
      throw err;
    }

    let invitations = [];
    if (role === "OWNER") {
      invitations = await prisma.workspaceInvitation.findMany({
        where: {
          workspaceId,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        include: {
          invitedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return {
      ...workspace,
      currentUserRole: role,
      members: workspace.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        profilePhoto: m.user.profilePhoto,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      invitations,
    };
  }

  /**
   * Update workspace details (Owner only)
   */
  async updateWorkspace(userId, workspaceId, { name, description }) {
    const role = await this.getUserWorkspaceRole(userId, workspaceId);
    if (role !== "OWNER") {
      const err = new Error("Forbidden: Only workspace owners can update workspace settings");
      err.statusCode = 403;
      throw err;
    }

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description.trim();

    return prisma.workspace.update({
      where: { id: workspaceId },
      data,
    });
  }

  /**
   * Delete workspace (Owner only)
   */
  async deleteWorkspace(userId, workspaceId) {
    const role = await this.getUserWorkspaceRole(userId, workspaceId);
    if (role !== "OWNER") {
      const err = new Error("Forbidden: Only workspace owners can delete this workspace");
      err.statusCode = 403;
      throw err;
    }

    await prisma.workspace.delete({
      where: { id: workspaceId },
    });

    return { success: true, message: "Workspace deleted successfully" };
  }

  /**
   * Invite a user by email to join a workspace
   */
  async inviteUser(userId, workspaceId, { email, role = "EDITOR" }) {
    const userRole = await this.getUserWorkspaceRole(userId, workspaceId);
    if (userRole !== "OWNER") {
      const err = new Error("Forbidden: Only workspace owners can send invitations");
      err.statusCode = 403;
      throw err;
    }

    const normalizedEmail = String(email || "").toLowerCase().trim();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      const err = new Error("A valid email address is required");
      err.statusCode = 400;
      throw err;
    }

    const validRoles = ["OWNER", "EDITOR", "VIEWER"];
    const normalizedRole = String(role || "EDITOR").toUpperCase();
    if (!validRoles.includes(normalizedRole)) {
      const err = new Error(`Invalid role '${role}'. Valid roles are: ${validRoles.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) {
      const err = new Error("Workspace not found");
      err.statusCode = 404;
      throw err;
    }

    // Check if the user is already a member
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      const isMember = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: existingUser.id,
          },
        },
      });

      if (isMember) {
        const err = new Error("User is already a member of this workspace");
        err.statusCode = 400;
        throw err;
      }
    }

    // Revoke any existing pending invitations for this email
    await prisma.workspaceInvitation.updateMany({
      where: {
        workspaceId,
        email: normalizedEmail,
        status: "PENDING",
      },
      data: {
        status: "REVOKED",
      },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const inviter = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const invitation = await prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        email: normalizedEmail,
        role: normalizedRole,
        token,
        status: "PENDING",
        invitedById: userId,
        expiresAt,
      },
    });

    // Send invitation email
    const emailRes = await mailService.sendWorkspaceInvitationEmail({
      toEmail: normalizedEmail,
      inviterName: inviter?.name || inviter?.email || "A collaborator",
      workspaceName: workspace.name,
      token,
      role: normalizedRole,
    });

    return {
      ...invitation,
      emailSent: emailRes?.sent ?? true,
      inviteUrl: emailRes?.inviteUrl,
    };
  }

  /**
   * List pending invitations for a workspace (Owner only)
   */
  async listWorkspaceInvitations(userId, workspaceId) {
    const role = await this.getUserWorkspaceRole(userId, workspaceId);
    if (role !== "OWNER") {
      const err = new Error("Forbidden: Only workspace owners can inspect invitations");
      err.statusCode = 403;
      throw err;
    }

    return prisma.workspaceInvitation.findMany({
      where: {
        workspaceId,
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        invitedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Revoke an invitation (Owner only)
   */
  async revokeInvitation(userId, workspaceId, invitationId) {
    const role = await this.getUserWorkspaceRole(userId, workspaceId);
    if (role !== "OWNER") {
      const err = new Error("Forbidden: Only workspace owners can revoke invitations");
      err.statusCode = 403;
      throw err;
    }

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.workspaceId !== workspaceId) {
      const err = new Error("Invitation not found");
      err.statusCode = 404;
      throw err;
    }

    await prisma.workspaceInvitation.update({
      where: { id: invitationId },
      data: { status: "REVOKED" },
    });

    return { success: true, message: "Invitation revoked successfully" };
  }

  /**
   * List pending invitations sent to the authenticated user's email
   */
  async listUserPendingInvitations(userEmail) {
    if (!userEmail) return [];

    return prisma.workspaceInvitation.findMany({
      where: {
        email: userEmail.toLowerCase().trim(),
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      include: {
        workspace: {
          select: { id: true, name: true, description: true },
        },
        invitedBy: {
          select: { id: true, name: true, email: true, profilePhoto: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Accept an invitation using its secret token
   */
  async acceptInvitation(userId, userEmail, token) {
    if (!token) {
      const err = new Error("Invitation token is required");
      err.statusCode = 400;
      throw err;
    }

    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: true,
      },
    });

    if (!invitation) {
      const err = new Error("Invalid invitation token");
      err.statusCode = 404;
      throw err;
    }

    if (invitation.status !== "PENDING") {
      const err = new Error(`Invitation is already ${invitation.status.toLowerCase()}`);
      err.statusCode = 400;
      throw err;
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      const err = new Error("This invitation has expired");
      err.statusCode = 400;
      throw err;
    }

    // Verify recipient email matches
    if (invitation.email.toLowerCase() !== userEmail.toLowerCase().trim()) {
      const err = new Error("This invitation was issued for a different email address");
      err.statusCode = 403;
      throw err;
    }

    return prisma.$transaction(async (tx) => {
      // Upsert membership
      const member = await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invitation.workspaceId,
            userId,
          },
        },
        update: {
          role: invitation.role,
        },
        create: {
          workspaceId: invitation.workspaceId,
          userId,
          role: invitation.role,
        },
      });

      // Mark invitation accepted
      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: "ACCEPTED",
          respondedAt: new Date(),
        },
      });

      return {
        success: true,
        workspaceId: invitation.workspaceId,
        workspaceName: invitation.workspace.name,
        role: member.role,
      };
    });
  }

  /**
   * Reject an invitation
   */
  async rejectInvitation(userId, userEmail, token) {
    const invitation = await prisma.workspaceInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      const err = new Error("Invalid invitation token");
      err.statusCode = 404;
      throw err;
    }

    if (invitation.email.toLowerCase() !== userEmail.toLowerCase().trim()) {
      const err = new Error("This invitation was issued for a different email address");
      err.statusCode = 403;
      throw err;
    }

    await prisma.workspaceInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "REJECTED",
        respondedAt: new Date(),
      },
    });

    return { success: true, message: "Invitation declined" };
  }

  /**
   * Remove a member or leave a workspace
   */
  async removeMember(userId, workspaceId, targetUserId) {
    const callerRole = await this.getUserWorkspaceRole(userId, workspaceId);
    if (!callerRole) {
      const err = new Error("Forbidden: You do not have access to this workspace");
      err.statusCode = 403;
      throw err;
    }

    const isSelf = userId === targetUserId;

    // Non-owners can only remove themselves
    if (!isSelf && callerRole !== "OWNER") {
      const err = new Error("Forbidden: Only workspace owners can remove members");
      err.statusCode = 403;
      throw err;
    }

    // Check target membership
    const targetMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUserId,
        },
      },
    });

    if (!targetMember) {
      const err = new Error("Member not found in this workspace");
      err.statusCode = 404;
      throw err;
    }

    // Prevent removing the sole owner
    if (targetMember.role === "OWNER") {
      const ownerCount = await prisma.workspaceMember.count({
        where: {
          workspaceId,
          role: "OWNER",
        },
      });

      if (ownerCount <= 1) {
        const err = new Error("Cannot remove the sole owner of the workspace. Please assign another owner first.");
        err.statusCode = 400;
        throw err;
      }
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUserId,
        },
      },
    });

    try {
      defaultCollaborationServer.revokeUserSessions(targetUserId, workspaceId);
    } catch (e) {
      // ignore
    }

    return {
      success: true,
      message: isSelf ? "Left workspace successfully" : "Member removed successfully",
    };
  }

  /**
   * Update a member's role (Owner only)
   */
  async updateMemberRole(userId, workspaceId, targetUserId, newRole) {
    const callerRole = await this.getUserWorkspaceRole(userId, workspaceId);
    if (callerRole !== "OWNER") {
      const err = new Error("Forbidden: Only workspace owners can update member roles");
      err.statusCode = 403;
      throw err;
    }

    const validRoles = ["OWNER", "EDITOR", "VIEWER"];
    const normalizedRole = String(newRole).toUpperCase();
    if (!validRoles.includes(normalizedRole)) {
      const err = new Error(`Invalid role. Valid roles are: ${validRoles.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }

    const targetMember = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUserId,
        },
      },
    });

    if (!targetMember) {
      const err = new Error("Member not found in workspace");
      err.statusCode = 404;
      throw err;
    }

    // If demoting an owner, verify there is at least one other owner
    if (targetMember.role === "OWNER" && normalizedRole !== "OWNER") {
      const ownerCount = await prisma.workspaceMember.count({
        where: { workspaceId, role: "OWNER" },
      });
      if (ownerCount <= 1) {
        const err = new Error("Cannot demote the only workspace owner. Assign another owner first.");
        err.statusCode = 400;
        throw err;
      }
    }

    const updated = await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUserId,
        },
      },
      data: { role: normalizedRole },
    });

    return {
      success: true,
      member: updated,
    };
  }

  /**
   * List workflows associated with a workspace
   */
  async listWorkspaceWorkflows(userId, workspaceId) {
    const role = await this.getUserWorkspaceRole(userId, workspaceId);
    if (!role) {
      const err = new Error("Forbidden: You do not have access to this workspace");
      err.statusCode = 403;
      throw err;
    }

    const workflows = await prisma.workflow.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true, profilePhoto: true },
        },
        versions: {
          orderBy: { version: "desc" },
          take: 1,
          select: {
            id: true,
            version: true,
            schemaVersion: true,
            createdAt: true,
            definitionJson: true,
          },
        },
        _count: {
          select: { versions: true },
        },
      },
    });

    return workflows.map((wf) => {
      const latestVersion = wf.versions[0] || null;
      const def = latestVersion ? latestVersion.definitionJson : null;
      return {
        id: wf.id,
        ownerId: wf.ownerId,
        owner: wf.user,
        workspaceId: wf.workspaceId,
        name: wf.name,
        description: wf.description,
        createdAt: wf.createdAt,
        updatedAt: wf.updatedAt,
        latestVersion: latestVersion ? latestVersion.version : 1,
        latestVersionId: latestVersion ? latestVersion.id : null,
        nodesCount: def && Array.isArray(def.nodes) ? def.nodes.length : 0,
        edgesCount: def && Array.isArray(def.edges) ? def.edges.length : 0,
        totalVersions: wf._count.versions,
        currentUserRole: role,
      };
    });
  }
}

module.exports = new WorkspaceService();
