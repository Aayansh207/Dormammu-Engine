import React, { useState, useEffect } from "react";
import {
  X,
  History,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Layers,
  Sparkles,
  GitCommit,
  Check,
} from "lucide-react";
import { api } from "../../services/api";

export default function VersionHistoryDrawer({
  isOpen,
  onClose,
  workflowId,
  currentVersion = 1,
  userRole = "VIEWER",
  onRestoreVersion,
}) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const canModify = userRole === "OWNER" || userRole === "EDITOR";

  useEffect(() => {
    if (isOpen && workflowId) {
      loadVersions();
    }
  }, [isOpen, workflowId]);

  const loadVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listWorkflowVersions(workflowId);
      setVersions(res.data || []);
    } catch (err) {
      setError(err.message || "Failed to load versions");
    } finally {
      setLoading(false);
    }
  };

  const handleInspectVersion = async (vNumber) => {
    try {
      const res = await api.getWorkflowVersion(workflowId, vNumber);
      setSelectedVersion(res.data);
    } catch (err) {
      setError(err.message || "Failed to load version details");
    }
  };

  const handleRestore = async (vNumber) => {
    if (!canModify) return;
    if (!window.confirm(`Restore Version ${vNumber}? This will publish it as the new active version.`)) return;

    setRestoringVersion(vNumber);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.restoreWorkflowVersion(workflowId, vNumber);
      setSuccess(`Version ${vNumber} restored successfully as Version ${res.data.newVersion}!`);
      onRestoreVersion?.(res.data);
      await loadVersions();
    } catch (err) {
      setError(err.message || "Failed to restore version");
    } finally {
      setRestoringVersion(null);
    }
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "380px",
        maxWidth: "90vw",
        backgroundColor: "var(--bg-card, #ffffff)",
        borderLeft: "1px solid var(--border-subtle, rgba(85, 123, 131, 0.2))",
        boxShadow: "-8px 0 24px rgba(0, 0, 0, 0.12)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-subtle, rgba(85, 123, 131, 0.15))",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--bg-secondary, #f8fafc)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <History size={18} style={{ color: "var(--brand, #39AEA9)" }} />
          <div>
            <h3
              style={{
                fontSize: "15px",
                fontWeight: 700,
                margin: 0,
                color: "var(--text-primary, #1e293b)",
              }}
            >
              Version History
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--text-muted, #64748b)" }}>
              Immutable workflow revisions & snapshots
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
            padding: "4px",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div
          style={{
            margin: "12px 16px 0",
            padding: "8px 12px",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "6px",
            color: "#ef4444",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          style={{
            margin: "12px 16px 0",
            padding: "8px 12px",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "6px",
            color: "#10b981",
            fontSize: "12px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <CheckCircle2 size={14} />
          <span>{success}</span>
        </div>
      )}

      {/* Body List */}
      <div style={{ padding: "16px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
            <Loader2 size={24} className="animate-spin" style={{ color: "var(--brand, #39AEA9)" }} />
          </div>
        ) : versions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted, #64748b)", fontSize: "13px" }}>
            No saved versions found.
          </div>
        ) : (
          versions.map((v) => {
            const isCurrent = v.version === currentVersion;
            const isRestoring = restoringVersion === v.version;

            return (
              <div
                key={v.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: isCurrent ? "2px solid var(--brand, #39AEA9)" : "1px solid var(--border-subtle, #e2e8f0)",
                  background: isCurrent ? "var(--brand-light, rgba(57,174,169,0.06))" : "var(--bg-card, #fff)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <GitCommit size={16} style={{ color: isCurrent ? "var(--brand, #39AEA9)" : "var(--text-muted, #64748b)" }} />
                    <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--text-primary, #1e293b)" }}>
                      Version {v.version}
                    </span>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: "var(--brand, #39AEA9)",
                          color: "#fff",
                        }}
                      >
                        Current
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted, #94a3b8)" }}>
                    {formatTimestamp(v.createdAt)}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", color: "var(--text-secondary, #64748b)" }}>
                  <span>{v.nodesCount || 0} nodes</span>
                  <span>•</span>
                  <span>{v.edgesCount || 0} connections</span>
                </div>

                {!isCurrent && canModify && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                    <button
                      onClick={() => handleRestore(v.version)}
                      disabled={isRestoring}
                      style={{
                        padding: "5px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--border-medium, #cbd5e1)",
                        background: "var(--bg-secondary, #f8fafc)",
                        color: "var(--text-primary, #1e293b)",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      {isRestoring ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <RotateCcw size={12} />
                      )}
                      Restore this Version
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
