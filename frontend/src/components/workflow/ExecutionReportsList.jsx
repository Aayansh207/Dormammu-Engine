import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Filter,
  RotateCcw,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Calendar,
  Zap,
  Sliders,
  AlertTriangle,
  Play,
  Layers,
  Sparkles
} from "lucide-react";
import { api } from "../../services/api";

export default function ExecutionReportsList({
  user,
  onOpenReport,
  onNavigateWorkflows,
  onOpenAuth,
}) {
  const [runs, setRuns] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [copiedRunId, setCopiedRunId] = useState(null);

  const fetchRuns = async (page = 1) => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.listAllRuns({
        page,
        limit: pagination.limit,
        status: statusFilter,
        triggerType: triggerFilter,
        search: searchQuery.trim(),
      });
      if (res.data) {
        setRuns(res.data);
        if (res.pagination) {
          setPagination(res.pagination);
        }
      }
    } catch (err) {
      console.error("Failed to fetch execution runs:", err);
      setError(err.message || "Failed to retrieve execution reports from database");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns(1);
  }, [user, statusFilter, triggerFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRuns(1);
  };

  const handleCopyId = (e, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedRunId(id);
    setTimeout(() => setCopiedRunId(null), 2000);
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

  const getRelativeTime = (ts) => {
    if (!ts) return "";
    const diffMs = Date.now() - new Date(ts).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  if (!user) {
    return (
      <div style={{ maxWidth: "1200px", margin: "40px auto", padding: "0 20px" }}>
        <div
          className="glass-panel"
          style={{
            padding: "48px 24px",
            textAlign: "center",
            borderRadius: "16px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <FileText size={48} color="var(--brand)" style={{ margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--text-primary)" }}>
            Execution Reports &amp; History
          </h2>
          <p style={{ color: "var(--text-secondary)", maxWidth: "480px", margin: "8px auto 24px", fontSize: "0.9rem" }}>
            Sign in to inspect durable PostgreSQL execution reports, node inputs and outputs, timings, and webhook triggers.
          </p>
          <button
            onClick={() => onOpenAuth?.("login")}
            className="btn btn-primary"
            style={{ padding: "10px 24px", fontSize: "0.9rem" }}
          >
            Sign In to View Reports
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1240px", margin: "24px auto", padding: "0 20px", width: "100%" }}>
      {/* Page Title & Breadcrumb Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #39AEA9 0%, #A2D5AB 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 14px var(--brand-glow)",
              }}
            >
              <FileText size={18} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: "1.4rem", fontWeight: "800", color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
                Execution Reports
              </h1>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                Inspect durable, self-contained execution reports for all workflow triggers and runs.
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button
            onClick={() => fetchRuns(pagination.page)}
            disabled={isLoading}
            className="btn btn-secondary"
            style={{ padding: "8px 14px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px" }}
            title="Refresh runs"
          >
            <RotateCcw size={14} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>
          <button
            onClick={onNavigateWorkflows}
            className="btn btn-primary"
            style={{ padding: "8px 16px", fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px" }}
          >
            <Layers size={14} />
            Workflows
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="glass-panel"
        style={{
          padding: "14px 18px",
          borderRadius: "12px",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "16px",
          background: "var(--bg-secondary)",
        }}
      >
        {/* Search Input Form */}
        <form onSubmit={handleSearchSubmit} style={{ display: "flex", alignItems: "center", flex: "1 1 280px", maxWidth: "420px", position: "relative" }}>
          <Search size={15} color="var(--text-muted)" style={{ position: "absolute", left: "12px" }} />
          <input
            type="text"
            placeholder="Search by workflow name or run ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 34px",
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              color: "var(--text-primary)",
              fontSize: "0.82rem",
              outline: "none",
            }}
          />
        </form>

        {/* Filter Dropdowns */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "500" }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "6px",
                color: "var(--text-primary)",
                fontSize: "0.78rem",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="">All Statuses</option>
              <option value="SUCCEEDED">Succeeded</option>
              <option value="FAILED">Failed</option>
              <option value="RUNNING">Running</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: "500" }}>Trigger:</span>
            <select
              value={triggerFilter}
              onChange={(e) => setTriggerFilter(e.target.value)}
              style={{
                padding: "6px 10px",
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "6px",
                color: "var(--text-primary)",
                fontSize: "0.78rem",
                outline: "none",
                cursor: "pointer",
              }}
            >
              <option value="">All Triggers</option>
              <option value="MANUAL">Manual</option>
              <option value="WEBHOOK">Webhook</option>
              <option value="CRON">Cron</option>
              <option value="SYSTEM">System</option>
            </select>
          </div>

          {(statusFilter || triggerFilter || searchQuery) && (
            <button
              onClick={() => {
                setStatusFilter("");
                setTriggerFilter("");
                setSearchQuery("");
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--brand)",
                fontSize: "0.75rem",
                cursor: "pointer",
                padding: "4px 8px",
                fontWeight: "600",
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "10px",
            background: "rgba(244, 63, 94, 0.1)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangle size={18} color="#f43f5e" />
            <span style={{ fontSize: "0.82rem", color: "#f43f5e", fontWeight: "600" }}>
              {error}
            </span>
          </div>
          <button
            onClick={() => fetchRuns(pagination.page)}
            className="btn btn-secondary"
            style={{ padding: "4px 10px", fontSize: "0.75rem" }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div
          className="glass-panel"
          style={{
            padding: "60px 20px",
            textAlign: "center",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Loader2 size={28} className="animate-spin" color="var(--brand)" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Loading execution reports from PostgreSQL...
          </div>
        </div>
      ) : runs.length === 0 ? (
        /* Empty States */
        <div
          className="glass-panel"
          style={{
            padding: "54px 24px",
            textAlign: "center",
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          {searchQuery || statusFilter || triggerFilter ? (
            <>
              <Search size={36} color="var(--text-muted)" style={{ margin: "0 auto 12px" }} />
              <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)" }}>
                No execution reports found
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", maxWidth: "400px", margin: "6px auto 16px" }}>
                No runs match your current search query or active filter settings.
              </p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("");
                  setTriggerFilter("");
                }}
                className="btn btn-secondary"
                style={{ padding: "6px 14px", fontSize: "0.8rem" }}
              >
                Reset All Filters
              </button>
            </>
          ) : (
            <>
              <FileText size={40} color="var(--brand)" style={{ margin: "0 auto 14px" }} />
              <h3 style={{ fontSize: "1.15rem", fontWeight: "700", color: "var(--text-primary)" }}>
                No workflow executions recorded yet
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", maxWidth: "440px", margin: "6px auto 20px" }}>
                Execute any workflow manually, via webhook, or through a cron schedule. Self-contained durable reports will automatically appear here.
              </p>
              <button
                onClick={onNavigateWorkflows}
                className="btn btn-primary"
                style={{ padding: "8px 20px", fontSize: "0.84rem" }}
              >
                <Play size={14} /> Open Workflows
              </button>
            </>
          )}
        </div>
      ) : (
        /* Runs Table */
        <div
          className="glass-panel"
          style={{
            borderRadius: "12px",
            border: "1px solid var(--border-subtle)",
            overflow: "hidden",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.8rem" }}>
              <thead>
                <tr
                  style={{
                    background: "rgba(0, 0, 0, 0.25)",
                    borderBottom: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                    fontSize: "0.72rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <th style={{ padding: "12px 16px" }}>Workflow</th>
                  <th style={{ padding: "12px 14px" }}>Run ID</th>
                  <th style={{ padding: "12px 14px" }}>Status</th>
                  <th style={{ padding: "12px 14px" }}>Trigger</th>
                  <th style={{ padding: "12px 14px" }}>Started</th>
                  <th style={{ padding: "12px 14px" }}>Duration</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r, idx) => {
                  const isSucceeded = r.status === "SUCCEEDED";
                  const isFailed = r.status === "FAILED";
                  const isRunning = r.status === "RUNNING";

                  return (
                    <tr
                      key={r.id}
                      onClick={() => onOpenReport(r.id)}
                      style={{
                        borderBottom: idx === runs.length - 1 ? "none" : "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-chip)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Workflow Name */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: "700", color: "var(--text-primary)", fontSize: "0.85rem" }}>
                            {r.workflowName || "Workflow"}
                          </span>
                          <span
                            style={{
                              fontSize: "0.65rem",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              background: "rgba(255, 255, 255, 0.06)",
                              color: "var(--text-muted)",
                            }}
                          >
                            v{r.version || 1}
                          </span>
                        </div>
                        {r.errorSummary && (
                          <div
                            style={{
                              fontSize: "0.7rem",
                              color: "#f43f5e",
                              marginTop: "3px",
                              maxWidth: "320px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.errorSummary}
                          </div>
                        )}
                      </td>

                      {/* Run ID */}
                      <td style={{ padding: "14px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <code style={{ fontSize: "0.76rem", color: "var(--brand)", fontFamily: "var(--font-mono)" }}>
                            {r.id.slice(0, 8)}...
                          </code>
                          <button
                            type="button"
                            onClick={(e) => handleCopyId(e, r.id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              padding: "2px",
                            }}
                            title="Copy full Run ID"
                          >
                            {copiedRunId === r.id ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                          </button>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 14px" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            fontSize: "0.7rem",
                            fontWeight: "700",
                            background: isSucceeded
                              ? "rgba(16, 185, 129, 0.12)"
                              : isFailed
                              ? "rgba(244, 63, 94, 0.12)"
                              : "rgba(57, 174, 169, 0.12)",
                            color: isSucceeded ? "#10b981" : isFailed ? "#f43f5e" : "var(--brand)",
                            border: `1px solid ${
                              isSucceeded
                                ? "rgba(16, 185, 129, 0.25)"
                                : isFailed
                                ? "rgba(244, 63, 94, 0.25)"
                                : "rgba(57, 174, 169, 0.25)"
                            }`,
                          }}
                        >
                          {isSucceeded && <CheckCircle2 size={11} />}
                          {isFailed && <XCircle size={11} />}
                          {isRunning && <Loader2 size={11} className="animate-spin" />}
                          {r.status}
                        </span>
                      </td>

                      {/* Trigger Type */}
                      <td style={{ padding: "14px 14px" }}>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            padding: "2px 7px",
                            borderRadius: "4px",
                            background: "var(--bg-secondary)",
                            border: "1px solid var(--border-subtle)",
                            color: "var(--text-secondary)",
                            fontWeight: "600",
                          }}
                        >
                          {r.triggerType || "MANUAL"}
                        </span>
                      </td>

                      {/* Started Time */}
                      <td style={{ padding: "14px 14px", color: "var(--text-secondary)", fontSize: "0.76rem" }}>
                        <div>{formatTimestamp(r.startedAt || r.createdAt)}</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                          {getRelativeTime(r.startedAt || r.createdAt)}
                        </div>
                      </td>

                      {/* Duration */}
                      <td style={{ padding: "14px 14px", color: "var(--text-primary)", fontWeight: "600", fontSize: "0.78rem" }}>
                        {r.durationMs !== undefined && r.durationMs !== null ? `${r.durationMs} ms` : "—"}
                      </td>

                      {/* View Report Action */}
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenReport(r.id);
                          }}
                          className="btn btn-secondary"
                          style={{
                            padding: "4px 10px",
                            fontSize: "0.75rem",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          View Report
                          <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {pagination.totalPages > 1 && (
            <div
              style={{
                padding: "12px 18px",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(0, 0, 0, 0.15)",
                fontSize: "0.76rem",
                color: "var(--text-muted)",
              }}
            >
              <div>
                Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> (
                {pagination.total} total runs)
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => fetchRuns(pagination.page - 1)}
                  className="btn btn-secondary"
                  style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  type="button"
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  onClick={() => fetchRuns(pagination.page + 1)}
                  className="btn btn-secondary"
                  style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
