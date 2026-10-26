import React, { useState } from "react";
import {
  X,
  History,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Zap,
  Clock,
  Layers,
  ChevronRight
} from "lucide-react";

export default function PastRunsDrawer({
  isOpen,
  onClose,
  workflowId,
  workflowName,
  recentRuns = [],
  isLoadingHistory = false,
  onRefresh,
  onOpenReport,
}) {
  const [copiedId, setCopiedId] = useState(null);
  const [filter, setFilter] = useState("all"); // "all" | "succeeded" | "failed"

  if (!isOpen) return null;

  const handleCopy = (id, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
      second: "2-digit",
    });
  };

  const filteredRuns = recentRuns.filter((r) => {
    if (filter === "succeeded") return r.status === "SUCCEEDED";
    if (filter === "failed") return r.status === "FAILED";
    return true;
  });

  const succeededCount = recentRuns.filter((r) => r.status === "SUCCEEDED").length;
  const failedCount = recentRuns.filter((r) => r.status === "FAILED").length;

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: "56px",
        bottom: 0,
        width: "440px",
        maxWidth: "92vw",
        background: "var(--bg-card)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderLeft: "1px solid var(--border-subtle)",
        boxShadow: "-10px 0 30px rgba(0, 0, 0, 0.7)",
        zIndex: 40,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "slideInRight 0.22s ease-out",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
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
              borderRadius: "8px",
              background: "linear-gradient(135deg, #39AEA9, #557B83)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 12px rgba(57, 174, 169, 0.3)",
            }}
          >
            <History size={16} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h3 style={{ fontSize: "0.98rem", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                Past Runs
              </h3>
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
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
              {workflowName || "Workflow"} execution history
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh history"
            style={{
              background: "transparent",
              border: "1px solid var(--border-subtle)",
              borderRadius: "6px",
              padding: "5px 8px",
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "0.72rem",
            }}
          >
            <RotateCcw size={12} className={isLoadingHistory ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "5px",
              borderRadius: "6px",
            }}
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      {recentRuns.length > 0 && (
        <div
          style={{
            display: "flex",
            padding: "8px 16px",
            background: "var(--bg-main)",
            borderBottom: "1px solid var(--border-subtle)",
            gap: "6px",
          }}
        >
          {[
            { id: "all", label: `All (${recentRuns.length})` },
            { id: "succeeded", label: `Succeeded (${succeededCount})` },
            { id: "failed", label: `Failed (${failedCount})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: "3px 10px",
                borderRadius: "4px",
                border: "none",
                background: filter === f.id ? "var(--brand-light)" : "transparent",
                color: filter === f.id ? "var(--brand)" : "var(--text-muted)",
                fontSize: "0.72rem",
                fontWeight: filter === f.id ? "700" : "500",
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Runs List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        {isLoadingHistory && recentRuns.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--text-muted)" }}>
            <Loader2 size={24} className="animate-spin" color="var(--brand)" style={{ margin: "0 auto 10px" }} />
            <div style={{ fontSize: "0.82rem" }}>Loading execution history...</div>
          </div>
        ) : filteredRuns.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "50px 20px",
              color: "var(--text-muted)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <History size={36} color="var(--text-muted)" opacity={0.6} />
            <div style={{ fontSize: "0.88rem", fontWeight: "600", color: "var(--text-primary)" }}>
              No Past Executions Found
            </div>
            <div style={{ fontSize: "0.76rem", maxWidth: "260px", lineHeight: 1.4 }}>
              Execute this workflow manually using the Run button or send an HTTP webhook to generate execution reports.
            </div>
          </div>
        ) : (
          filteredRuns.map((r) => {
            const runId = r.id || r.runId;
            const isSucc = r.status === "SUCCEEDED";
            const isFail = r.status === "FAILED";
            const isRunning = r.status === "RUNNING";

            return (
              <div
                key={runId}
                style={{
                  background: "var(--bg-secondary)",
                  borderRadius: "10px",
                  border: `1px solid ${
                    isFail
                      ? "rgba(244, 63, 94, 0.25)"
                      : "var(--border-subtle)"
                  }`,
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Top Status & Duration Row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontWeight: "700",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        background: isSucc
                          ? "rgba(16, 185, 129, 0.12)"
                          : isFail
                          ? "rgba(244, 63, 94, 0.12)"
                          : "rgba(57, 174, 169, 0.12)",
                        color: isSucc ? "#10b981" : isFail ? "#f43f5e" : "var(--brand)",
                        border: `1px solid ${
                          isSucc
                            ? "rgba(16, 185, 129, 0.25)"
                            : isFail
                            ? "rgba(244, 63, 94, 0.25)"
                            : "rgba(57, 174, 169, 0.25)"
                        }`,
                      }}
                    >
                      {isSucc && <CheckCircle2 size={11} />}
                      {isFail && <XCircle size={11} />}
                      {isRunning && <Loader2 size={11} className="animate-spin" />}
                      {r.status}
                    </span>

                    <span
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--text-muted)",
                        background: "var(--bg-main)",
                        padding: "1px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      {r.triggerType || "MANUAL"}
                    </span>
                  </div>

                  <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", fontWeight: "600" }}>
                    {r.durationMs !== undefined ? `${r.durationMs} ms` : "—"}
                  </span>
                </div>

                {/* Run Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>ID:</span>
                      <code style={{ fontSize: "0.72rem", color: "var(--brand)", fontFamily: "var(--font-mono)" }}>
                        {runId}
                      </code>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleCopy(runId, e)}
                      title="Copy Run ID"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: copiedId === runId ? "#10b981" : "var(--text-muted)",
                        cursor: "pointer",
                        padding: "2px",
                      }}
                    >
                      {copiedId === runId ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>

                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Clock size={11} />
                    <span>{formatTimestamp(r.startedAt || r.createdAt)}</span>
                  </div>
                </div>

                {/* Primary Action: Link to Execution Report */}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenReport(runId);
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: "6px 12px",
                    fontSize: "0.76rem",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    width: "100%",
                    borderRadius: "6px",
                    fontWeight: "700",
                    background: "linear-gradient(135deg, #39AEA9, #479994)",
                    color: "#ffffff",
                    border: "none",
                    boxShadow: "0 2px 8px rgba(57, 174, 169, 0.25)",
                    cursor: "pointer",
                  }}
                >
                  <ExternalLink size={12} />
                  <span>View Execution Report</span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer link to all workspace reports */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-main)",
          textAlign: "center",
        }}
      >
        <a
          href="/runs"
          onClick={(e) => {
            e.preventDefault();
            onClose();
            window.history.pushState({}, "", "/runs");
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
          style={{
            fontSize: "0.78rem",
            color: "var(--brand)",
            textDecoration: "none",
            fontWeight: "600",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <span>View All Workspace Execution Reports</span>
          <ChevronRight size={13} />
        </a>
      </div>
    </div>
  );
}
