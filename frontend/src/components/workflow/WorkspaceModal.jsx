import React, { useState, useEffect } from "react";
import {
  X,
  Users,
  Plus,
  Mail,
  Shield,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserPlus,
  ArrowRight,
  LogOut,
  Building2,
  Inbox,
  Check,
  Ban,
  Clock,
} from "lucide-react";
import { api } from "../../services/api";

export default function WorkspaceModal({
  isOpen,
  onClose,
  activeWorkspace,
  onSelectWorkspace,
  onWorkspacesChanged,
}) {
  const [activeTab, setActiveTab] = useState("workspaces"); // "workspaces" | "members" | "invite" | "invitations"
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceDetails, setWorkspaceDetails] = useState(null);
  const [userInvitations, setUserInvitations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form states
  const [newWsName, setNewWsName] = useState("");
  const [newWsDesc, setNewWsDesc] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("EDITOR");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentUser = api.currentUser;

  useEffect(() => {
    if (isOpen) {
      loadInitialData();
    }
  }, [isOpen, activeWorkspace?.id]);

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [wsRes, invitesRes] = await Promise.all([
        api.listWorkspaces().catch(() => ({ data: [] })),
        api.listUserInvitations().catch(() => ({ data: [] })),
      ]);

      setWorkspaces(wsRes.data || []);
      setUserInvitations(invitesRes.data || []);

      if (activeWorkspace?.id) {
        const detailsRes = await api.getWorkspace(activeWorkspace.id).catch(() => null);
        if (detailsRes?.data) {
          setWorkspaceDetails(detailsRes.data);
        }
      }
    } catch (err) {
      setError(err.message || "Failed to load workspaces");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.createWorkspace({
        name: newWsName.trim(),
        description: newWsDesc.trim(),
      });

      setSuccess(`Workspace "${res.data.name}" created!`);
      setNewWsName("");
      setNewWsDesc("");
      onSelectWorkspace?.(res.data);
      onWorkspacesChanged?.();
      await loadInitialData();
      setActiveTab("workspaces");
    } catch (err) {
      setError(err.message || "Failed to create workspace");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !inviteEmail.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.inviteWorkspaceMember(activeWorkspace.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      setSuccess(`Invitation sent to ${inviteEmail}!`);
      setInviteEmail("");
      await loadInitialData();
    } catch (err) {
      setError(err.message || "Failed to send invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeInvite = async (invitationId) => {
    if (!activeWorkspace?.id) return;
    try {
      await api.revokeWorkspaceInvitation(activeWorkspace.id, invitationId);
      setSuccess("Invitation revoked");
      await loadInitialData();
    } catch (err) {
      setError(err.message || "Failed to revoke invitation");
    }
  };

  const handleAcceptInvite = async (token) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await api.acceptWorkspaceInvitation(token);
      setSuccess("Joined workspace successfully!");
      onWorkspacesChanged?.();
      await loadInitialData();
      if (res.data?.workspaceId) {
        const joined = workspaces.find((w) => w.id === res.data.workspaceId);
        if (joined) onSelectWorkspace?.(joined);
      }
    } catch (err) {
      setError(err.message || "Failed to accept invitation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectInvite = async (token) => {
    try {
      await api.rejectWorkspaceInvitation(token);
      setSuccess("Invitation declined");
      await loadInitialData();
    } catch (err) {
      setError(err.message || "Failed to decline invitation");
    }
  };

  const handleRemoveMember = async (memberUserId) => {
    if (!activeWorkspace?.id) return;
    const isSelf = memberUserId === currentUser?.id;
    if (!window.confirm(isSelf ? "Leave this workspace?" : "Remove this member?")) return;

    try {
      await api.removeWorkspaceMember(activeWorkspace.id, memberUserId);
      setSuccess(isSelf ? "Left workspace" : "Member removed");
      if (isSelf) {
        onSelectWorkspace?.(null);
      }
      onWorkspacesChanged?.();
      await loadInitialData();
    } catch (err) {
      setError(err.message || "Failed to remove member");
    }
  };

  const handleRoleChange = async (memberUserId, newRole) => {
    if (!activeWorkspace?.id) return;
    try {
      await api.updateWorkspaceMemberRole(activeWorkspace.id, memberUserId, newRole);
      setSuccess("Member role updated");
      await loadInitialData();
    } catch (err) {
      setError(err.message || "Failed to update role");
    }
  };

  const isOwner = workspaceDetails?.currentUserRole === "OWNER" || activeWorkspace?.role === "OWNER";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          backgroundColor: "var(--bg-card, #ffffff)",
          border: "1px solid var(--border-subtle, rgba(85, 123, 131, 0.2))",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border-subtle, rgba(85, 123, 131, 0.15))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--bg-secondary, #f8fafc)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "var(--brand-light, rgba(57, 174, 169, 0.15))",
                color: "var(--brand, #39AEA9)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  margin: 0,
                  color: "var(--text-primary, #1e293b)",
                  fontFamily: "var(--font-display, inherit)",
                }}
              >
                Shared Workspaces
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
                Collaborate in real-time with granular Owner, Editor, and Viewer roles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted, #64748b)",
              padding: "6px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border-subtle, rgba(85, 123, 131, 0.15))",
            padding: "0 24px",
            background: "var(--bg-card, #ffffff)",
            gap: "8px",
          }}
        >
          {[
            { id: "workspaces", label: "Workspaces", icon: Building2 },
            ...(activeWorkspace
              ? [
                  { id: "members", label: "Members", icon: Users },
                  ...(isOwner ? [{ id: "invite", label: "Invite", icon: UserPlus }] : []),
                ]
              : []),
            {
              id: "invitations",
              label: `Invitations (${userInvitations.length})`,
              icon: Inbox,
              badge: userInvitations.length,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setError(null);
                  setSuccess(null);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "12px 14px",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "var(--brand, #39AEA9)" : "var(--text-secondary, #64748b)",
                  border: "none",
                  background: "transparent",
                  borderBottom: isActive ? "2px solid var(--brand, #39AEA9)" : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Alerts */}
        {error && (
          <div
            style={{
              margin: "16px 24px 0",
              padding: "10px 14px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "#ef4444",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div
            style={{
              margin: "16px 24px 0",
              padding: "10px 14px",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: "8px",
              color: "#10b981",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <CheckCircle2 size={16} />
            <span>{success}</span>
          </div>
        )}

        {/* Content Body */}
        <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
              <Loader2 size={28} className="animate-spin" style={{ color: "var(--brand, #39AEA9)" }} />
            </div>
          ) : activeTab === "workspaces" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Personal Space option */}
              <div
                onClick={() => onSelectWorkspace?.(null)}
                style={{
                  padding: "14px 16px",
                  borderRadius: "10px",
                  border: !activeWorkspace ? "2px solid var(--brand, #39AEA9)" : "1px solid var(--border-subtle, #e2e8f0)",
                  backgroundColor: !activeWorkspace ? "var(--brand-light, rgba(57,174,169,0.08))" : "var(--bg-card, #fff)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  transition: "all 0.15s ease",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary, #1e293b)" }}>
                    Personal Workspace
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #64748b)", marginTop: "2px" }}>
                    Your private workflows accessible only by your account
                  </div>
                </div>
                {!activeWorkspace && (
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "var(--brand, #39AEA9)",
                      background: "rgba(57,174,169,0.15)",
                      padding: "4px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    Active
                  </span>
                )}
              </div>

              {/* Shared Workspaces List */}
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted, #64748b)", marginBottom: "10px" }}>
                  Shared Workspaces ({workspaces.length})
                </div>

                {workspaces.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted, #64748b)", fontSize: "13px", background: "var(--bg-secondary, #f8fafc)", borderRadius: "8px" }}>
                    You have not joined any shared workspaces yet. Create one below or accept an invitation.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {workspaces.map((ws) => {
                      const isSelected = activeWorkspace?.id === ws.id;
                      return (
                        <div
                          key={ws.id}
                          onClick={() => onSelectWorkspace?.(ws)}
                          style={{
                            padding: "14px 16px",
                            borderRadius: "10px",
                            border: isSelected ? "2px solid var(--brand, #39AEA9)" : "1px solid var(--border-subtle, #e2e8f0)",
                            backgroundColor: isSelected ? "var(--brand-light, rgba(57,174,169,0.08))" : "var(--bg-card, #fff)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary, #1e293b)" }}>
                                {ws.name}
                              </span>
                              <span
                                style={{
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor:
                                    ws.role === "OWNER"
                                      ? "rgba(147, 51, 234, 0.15)"
                                      : ws.role === "EDITOR"
                                      ? "rgba(16, 185, 129, 0.15)"
                                      : "rgba(100, 116, 139, 0.15)",
                                  color:
                                    ws.role === "OWNER"
                                      ? "#9333ea"
                                      : ws.role === "EDITOR"
                                      ? "#10b981"
                                      : "#64748b",
                                }}
                              >
                                {ws.role}
                              </span>
                            </div>
                            {ws.description && (
                              <div style={{ fontSize: "12px", color: "var(--text-muted, #64748b)", marginTop: "2px" }}>
                                {ws.description}
                              </div>
                            )}
                            <div style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)", marginTop: "4px" }}>
                              {ws.membersCount || 1} members • {ws.workflowsCount || 0} workflows
                            </div>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {isSelected && (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  color: "var(--brand, #39AEA9)",
                                  background: "rgba(57,174,169,0.15)",
                                  padding: "4px 8px",
                                  borderRadius: "6px",
                                }}
                              >
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Create New Workspace Form */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px dashed var(--border-medium, rgba(85,123,131,0.3))",
                  background: "var(--bg-secondary, #f8fafc)",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary, #1e293b)", marginBottom: "12px" }}>
                  Create New Shared Workspace
                </div>
                <form onSubmit={handleCreateWorkspace} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <input
                    type="text"
                    placeholder="Workspace Name (e.g. Core Engineering, Marketing Ops)"
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    required
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-medium, #cbd5e1)",
                      fontSize: "13px",
                      background: "var(--bg-card, #fff)",
                      color: "var(--text-primary, #1e293b)",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newWsDesc}
                    onChange={(e) => setNewWsDesc(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-medium, #cbd5e1)",
                      fontSize: "13px",
                      background: "var(--bg-card, #fff)",
                      color: "var(--text-primary, #1e293b)",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !newWsName.trim()}
                    style={{
                      alignSelf: "flex-end",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "var(--brand, #39AEA9)",
                      color: "#fff",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      opacity: isSubmitting || !newWsName.trim() ? 0.6 : 1,
                    }}
                  >
                    {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Create Workspace
                  </button>
                </form>
              </div>
            </div>
          ) : activeTab === "members" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary, #1e293b)" }}>
                    {workspaceDetails?.name || activeWorkspace?.name} Members
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
                    {workspaceDetails?.members?.length || 1} collaborators with access
                  </p>
                </div>
                {isOwner && (
                  <button
                    onClick={() => setActiveTab("invite")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "8px",
                      background: "var(--brand, #39AEA9)",
                      color: "#fff",
                      border: "none",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <UserPlus size={14} /> Invite Member
                  </button>
                )}
              </div>

              {/* Members List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(workspaceDetails?.members || []).map((m) => {
                  const isCurrent = m.userId === currentUser?.id;
                  return (
                    <div
                      key={m.id}
                      style={{
                        padding: "12px 14px",
                        borderRadius: "10px",
                        border: "1px solid var(--border-subtle, #e2e8f0)",
                        background: "var(--bg-card, #fff)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            background: "linear-gradient(135deg, #6366f1, #39AEA9)",
                            color: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "13px",
                          }}
                        >
                          {(m.name || m.email || "U")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary, #1e293b)" }}>
                            {m.name || m.email} {isCurrent && <span style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>(You)</span>}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
                            {m.email}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {isOwner && !isCurrent ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.userId, e.target.value)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: "1px solid var(--border-medium, #cbd5e1)",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: "var(--bg-secondary, #f8fafc)",
                              color: "var(--text-primary, #1e293b)",
                              cursor: "pointer",
                            }}
                          >
                            <option value="OWNER">OWNER</option>
                            <option value="EDITOR">EDITOR</option>
                            <option value="VIEWER">VIEWER</option>
                          </select>
                        ) : (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: "4px",
                              backgroundColor:
                                m.role === "OWNER"
                                  ? "rgba(147, 51, 234, 0.12)"
                                  : m.role === "EDITOR"
                                  ? "rgba(16, 185, 129, 0.12)"
                                  : "rgba(100, 116, 139, 0.12)",
                              color:
                                m.role === "OWNER"
                                  ? "#9333ea"
                                  : m.role === "EDITOR"
                                  ? "#10b981"
                                  : "#64748b",
                            }}
                          >
                            {m.role}
                          </span>
                        )}

                        {(isOwner || isCurrent) && (
                          <button
                            onClick={() => handleRemoveMember(m.userId)}
                            title={isCurrent ? "Leave Workspace" : "Remove Member"}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#ef4444",
                              cursor: "pointer",
                              padding: "4px",
                              borderRadius: "6px",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            {isCurrent ? <LogOut size={16} /> : <Trash2 size={16} />}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeTab === "invite" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "var(--text-primary, #1e293b)" }}>
                  Invite Collaborator to {workspaceDetails?.name || activeWorkspace?.name}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
                  Sent invitations expire in 7 days. Collaborators receive an invitation link via email.
                </p>
              </div>

              <form onSubmit={handleSendInvite} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary, #475569)", display: "block", marginBottom: "4px" }}>
                    Collaborator Email
                  </label>
                  <input
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-medium, #cbd5e1)",
                      fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-secondary, #475569)", display: "block", marginBottom: "4px" }}>
                    Role & Permissions
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                    {[
                      { role: "EDITOR", title: "Editor", desc: "Can view, modify, save, and run workflows" },
                      { role: "VIEWER", title: "Viewer", desc: "Can view workflows and execution runs only" },
                      { role: "OWNER", title: "Owner", desc: "Full access + workspace & member management" },
                    ].map((item) => (
                      <div
                        key={item.role}
                        onClick={() => setInviteRole(item.role)}
                        style={{
                          padding: "10px",
                          borderRadius: "8px",
                          border: inviteRole === item.role ? "2px solid var(--brand, #39AEA9)" : "1px solid var(--border-subtle, #cbd5e1)",
                          backgroundColor: inviteRole === item.role ? "var(--brand-light, rgba(57,174,169,0.06))" : "var(--bg-card, #fff)",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: "13px", color: "var(--text-primary, #1e293b)" }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: "11px", color: "var(--text-muted, #64748b)", marginTop: "2px" }}>
                          {item.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !inviteEmail.trim()}
                  style={{
                    alignSelf: "flex-end",
                    marginTop: "8px",
                    padding: "9px 18px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--brand, #39AEA9)",
                    color: "#fff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    opacity: isSubmitting || !inviteEmail.trim() ? 0.6 : 1,
                  }}
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                  Send Invitation
                </button>
              </form>

              {/* Pending Invitations Sent */}
              {(workspaceDetails?.invitations?.length || 0) > 0 && (
                <div style={{ marginTop: "10px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted, #64748b)", marginBottom: "8px" }}>
                    Pending Sent Invitations ({workspaceDetails.invitations.length})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {workspaceDetails.invitations.map((inv) => (
                      <div
                        key={inv.id}
                        style={{
                          padding: "10px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border-subtle, #e2e8f0)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: "12px",
                        }}
                      >
                        <div>
                          <span style={{ fontWeight: 600, color: "var(--text-primary, #1e293b)" }}>{inv.email}</span>
                          <span style={{ marginLeft: "8px", padding: "2px 6px", borderRadius: "4px", background: "rgba(100,116,139,0.1)", color: "#64748b", fontSize: "10px", fontWeight: 700 }}>
                            {inv.role}
                          </span>
                        </div>
                        <button
                          onClick={() => handleRevokeInvite(inv.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "11px",
                            fontWeight: 600,
                          }}
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* User Received Invitations Tab */
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted, #64748b)" }}>
                Invitations Received ({userInvitations.length})
              </div>

              {userInvitations.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted, #64748b)", fontSize: "13px", background: "var(--bg-secondary, #f8fafc)", borderRadius: "8px" }}>
                  You have no pending invitations. When collaborators invite you by email, they will appear here.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {userInvitations.map((inv) => (
                    <div
                      key={inv.id}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "10px",
                        border: "1px solid var(--border-subtle, #e2e8f0)",
                        background: "var(--bg-card, #fff)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text-primary, #1e293b)" }}>
                            {inv.workspace?.name}
                          </span>
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "rgba(57,174,169,0.15)",
                              color: "var(--brand, #39AEA9)",
                            }}
                          >
                            {inv.role}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted, #64748b)", marginTop: "2px" }}>
                          Invited by {inv.invitedBy?.name || inv.invitedBy?.email || "Team member"}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                          onClick={() => handleAcceptInvite(inv.token)}
                          disabled={isSubmitting}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "none",
                            background: "var(--brand, #39AEA9)",
                            color: "#fff",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Check size={14} /> Accept
                        </button>
                        <button
                          onClick={() => handleRejectInvite(inv.token)}
                          disabled={isSubmitting}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "1px solid var(--border-medium, #cbd5e1)",
                            background: "transparent",
                            color: "var(--text-muted, #64748b)",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
