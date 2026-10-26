import React, { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  Code2,
  Layers,
  Terminal,
  Zap,
  FastForward,
  Ban,
  AlertTriangle,
  FileText,
  Loader2,
  Calendar,
  Sparkles,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Hash
} from "lucide-react";
import { api } from "../../services/api";

export default function ExecutionReportDetail({
  runId,
  onBack,
  onOpenWorkflow,
  onOpenAuth,
}) {
  const [run, setRun] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [activeTab, setActiveTab] = useState("output"); // "output" | "timeline" | "nodes" | "trigger" | "raw"
  const [expandedNodes, setExpandedNodes] = useState({});
  const [nodeFilter, setNodeFilter] = useState("all"); // "all" | "succeeded" | "failed" | "skipped"
  const [selectedNodeTab, setSelectedNodeTab] = useState({}); // nodeId -> "output" | "input" | "error"
  const unsubscribeRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const fetchRun = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const res = await api.getRunDetails(runId);
      if (res.data) {
        setRun(res.data);
      } else {
        setError("Execution report data was empty");
      }
    } catch (err) {
      console.error("Failed to load run:", err);
      setError(err.message || "Failed to retrieve execution report");
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!runId) return;
    fetchRun(false);

    // Setup live subscription if run might be active
    const cleanup = () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };

    return cleanup;
  }, [runId]);

  // Handle live polling/SSE if run is RUNNING
  useEffect(() => {
    if (!run || run.status !== "RUNNING") return;

    // SSE subscription for live events
    try {
      unsubscribeRef.current = api.subscribeToRunEvents(
        runId,
        (eventType, payload) => {
          if (eventType === "workflow:completed") {
            fetchRun(true);
          }
        },
        (err) => {
          // SSE fallback to polling
        }
      );
    } catch {
      // ignore
    }

    // Polling fallback every 2.5s while RUNNING
    pollIntervalRef.current = setInterval(() => {
      fetchRun(true);
    }, 2500);

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [run?.status, runId]);

  const handleCopy = (text, fieldName) => {
    const content = typeof text === "object" ? JSON.stringify(text, null, 2) : String(text);
    navigator.clipboard.writeText(content);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const toggleNodeExpanded = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
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

  // Derive report, nodes, and stats from the persisted run
  const report = run?.report || null;
  const nodes = Array.isArray(report?.nodes)
    ? report.nodes
    : (run?.taskRuns || Object.values(run?.tasks || {}));

  // Chronological order for timeline
  const orderedNodes = [...nodes].sort((a, b) => {
    const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return timeA - timeB;
  });

  const totalNodesCount = nodes.length;
  const succeededCount = nodes.filter((n) => n.status === "SUCCEEDED").length;
  const failedCount = nodes.filter((n) => n.status === "FAILED").length;
  const skippedCount = nodes.filter((n) => n.status === "SKIPPED" || n.status === "BLOCKED").length;

  const durationMs = run?.durationMs ?? report?.execution?.durationMs ?? 0;
  const isRunning = run?.status === "RUNNING";
  const isSucceeded = run?.status === "SUCCEEDED";
  const isFailed = run?.status === "FAILED";

  const finalOutput = run?.finalOutput !== undefined ? run.finalOutput : (run?.output !== undefined ? run.output : report?.output);

  // Filtered nodes for Node Inspector
  const filteredNodes = nodes.filter((n) => {
    if (nodeFilter === "succeeded") return n.status === "SUCCEEDED";
    if (nodeFilter === "failed") return n.status === "FAILED";
    if (nodeFilter === "skipped") return n.status === "SKIPPED" || n.status === "BLOCKED";
    return true;
  });

  if (isLoading) {
    return (
      <div style={{ maxWidth: "1240px", margin: "40px auto", padding: "0 20px" }}>
        <button
          onClick={onBack}
          className="btn btn-ghost"
          style={{ marginBottom: "16px", padding: "6px 12px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <ArrowLeft size={14} /> Back to Reports
        </button>
        <div
          className="glass-panel"
          style={{
            padding: "80px 20px",
            textAlign: "center",
            borderRadius: "16px",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <Loader2 size={32} className="animate-spin" color="var(--brand)" style={{ margin: "0 auto 14px" }} />
          <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "var(--text-primary)" }}>
            Loading Execution Report...
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Retrieving execution snapshot from PostgreSQL
          </div>
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div style={{ maxWidth: "1240px", margin: "40px auto", padding: "0 20px" }}>
        <button
          onClick={onBack}
          className="btn btn-ghost"
          style={{ marginBottom: "16px", padding: "6px 12px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <ArrowLeft size={14} /> Back to Reports
        </button>
        <div
          className="glass-panel"
          style={{
            padding: "50px 24px",
            textAlign: "center",
            borderRadius: "16px",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            background: "rgba(244, 63, 94, 0.05)",
          }}
        >
          <AlertTriangle size={36} color="#f43f5e" style={{ margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: "1.2rem", fontWeight: "700", color: "#f43f5e" }}>
            Execution Report Not Found
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", maxWidth: "460px", margin: "8px auto 20px" }}>
            {error || `Run with ID '${runId}' could not be located in PostgreSQL or access was restricted.`}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <button
              onClick={() => fetchRun(false)}
              className="btn btn-secondary"
              style={{ padding: "8px 16px", fontSize: "0.82rem" }}
            >
              <RotateCcw size={14} /> Retry Loading
            </button>
            <button
              onClick={onBack}
              className="btn btn-primary"
              style={{ padding: "8px 16px", fontSize: "0.82rem" }}
            >
              Return to Run History
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1240px", margin: "20px auto 40px", padding: "0 20px", width: "100%" }}>
      {/* Top Nav Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
        <button
          onClick={onBack}
          className="btn btn-ghost"
          style={{ padding: "6px 12px", fontSize: "0.82rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <ArrowLeft size={14} />
          <span>Back to All Reports</span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => fetchRun(false)}
            className="btn btn-secondary"
            style={{ padding: "6px 12px", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <RotateCcw size={13} className={isLoading ? "animate-spin" : ""} />
            Refresh
          </button>

          {run.workflowId && (
            <button
              onClick={() => onOpenWorkflow?.(run.workflowId)}
              className="btn btn-primary"
              style={{ padding: "6px 14px", fontSize: "0.78rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Layers size={13} />
              Open Workflow Canvas
            </button>
          )}
        </div>
      </div>

      {/* Main Report Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: "20px 24px",
          borderRadius: "14px",
          border: `1px solid ${
            isSucceeded
              ? "rgba(16, 185, 129, 0.35)"
              : isFailed
              ? "rgba(244, 63, 94, 0.35)"
              : "rgba(57, 174, 169, 0.35)"
          }`,
          background: "var(--bg-secondary)",
          marginBottom: "18px",
          boxShadow: "0 6px 25px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: "1.35rem", fontWeight: "800", color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
                {run.workflowName || report?.workflowName || "Workflow Execution"}
              </h1>
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)",
                  fontWeight: "600",
                }}
              >
                v{run.version || report?.version || 1}
              </span>
              <span
                style={{
                  fontSize: "0.7rem",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: "rgba(57, 174, 169, 0.15)",
                  border: "1px solid var(--brand)",
                  color: "var(--brand)",
                  fontWeight: "700",
                }}
              >
                Report v{report?.schemaVersion || "1.0.0"}
              </span>
            </div>

            {/* Run ID bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>Run ID:</span>
              <code style={{ fontSize: "0.78rem", color: "var(--brand)", fontFamily: "var(--font-mono)", background: "var(--bg-input)", padding: "2px 8px", borderRadius: "4px" }}>
                {run.id}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(run.id, "runId")}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  color: copiedField === "runId" ? "#10b981" : "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {copiedField === "runId" ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                {copiedField === "runId" ? "Copied" : "Copy ID"}
              </button>
            </div>
          </div>

          {/* Right Status Badge & Duration */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                {durationMs} ms
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Total Execution Time</div>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "8px 16px",
                borderRadius: "10px",
                fontWeight: "800",
                fontSize: "0.88rem",
                background: isSucceeded
                  ? "rgba(16, 185, 129, 0.15)"
                  : isFailed
                  ? "rgba(244, 63, 94, 0.15)"
                  : "rgba(57, 174, 169, 0.15)",
                color: isSucceeded ? "#10b981" : isFailed ? "#f43f5e" : "var(--brand)",
                border: `1px solid ${
                  isSucceeded
                    ? "rgba(16, 185, 129, 0.35)"
                    : isFailed
                    ? "rgba(244, 63, 94, 0.35)"
                    : "rgba(57, 174, 169, 0.35)"
                }`,
              }}
            >
              {isSucceeded && <CheckCircle2 size={18} />}
              {isFailed && <XCircle size={18} />}
              {isRunning && <Loader2 size={18} className="animate-spin" />}
              {run.status}
            </div>
          </div>
        </div>

        {/* Error Callout if Failed */}
        {isFailed && run.error && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px 14px",
              borderRadius: "8px",
              background: "rgba(244, 63, 94, 0.1)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
            }}
          >
            <AlertTriangle size={18} color="#f43f5e" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "#f43f5e" }}>
                Execution Failed
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text-primary)", marginTop: "2px", fontFamily: "var(--font-mono)" }}>
                {typeof run.error === "object" ? (run.error.message || JSON.stringify(run.error)) : String(run.error)}
              </div>
            </div>
          </div>
        )}

        {/* Live Running Notification */}
        {isRunning && (
          <div
            style={{
              marginTop: "16px",
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(57, 174, 169, 0.12)",
              border: "1px solid var(--brand)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Loader2 size={16} className="animate-spin" color="var(--brand)" />
            <span style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: "600" }}>
              DAG execution in progress. This report is streaming live updates via server-sent events.
            </span>
          </div>
        )}
      </div>

      {/* 2.2 Execution Summary Metrics Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "12px",
          marginBottom: "20px",
        }}
      >
        {/* Trigger Mode */}
        <div
          className="glass-panel"
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
          }}
        >
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Zap size={13} color="var(--brand)" /> Trigger Mode
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "var(--text-primary)", marginTop: "4px" }}>
            {run.triggerType || report?.trigger?.type || "MANUAL"}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
            {formatTimestamp(run.startedAt || report?.execution?.startedAt)}
          </div>
        </div>

        {/* Total Nodes Executed */}
        <div
          className="glass-panel"
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
          }}
        >
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <Layers size={13} color="var(--brand)" /> Nodes Executed
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "var(--text-primary)", marginTop: "4px" }}>
            {totalNodesCount}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Across all DAG branches
          </div>
        </div>

        {/* Succeeded Nodes */}
        <div
          className="glass-panel"
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
          }}
        >
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <CheckCircle2 size={13} color="#10b981" /> Succeeded Nodes
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "#10b981", marginTop: "4px" }}>
            {succeededCount}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
            {totalNodesCount > 0 ? `${Math.round((succeededCount / totalNodesCount) * 100)}% completion` : "0%"}
          </div>
        </div>

        {/* Failed Nodes */}
        <div
          className="glass-panel"
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
          }}
        >
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <XCircle size={13} color="#f43f5e" /> Failed Nodes
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: "800", color: failedCount > 0 ? "#f43f5e" : "var(--text-primary)", marginTop: "4px" }}>
            {failedCount}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
            {failedCount > 0 ? "Fault detected in DAG" : "Zero errors"}
          </div>
        </div>

        {/* Skipped / Blocked */}
        <div
          className="glass-panel"
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
          }}
        >
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <FastForward size={13} color="var(--text-muted)" /> Skipped / Blocked
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "var(--text-primary)", marginTop: "4px" }}>
            {skippedCount}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
            Inactive branch paths
          </div>
        </div>

        {/* DB Writes Architecture */}
        <div
          className="glass-panel"
          style={{
            padding: "12px 16px",
            borderRadius: "10px",
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
          }}
        >
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
            <ShieldCheck size={13} color="#10b981" /> DB Writes
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: "800", color: "#10b981", marginTop: "4px" }}>
            0 TaskRuns
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
            1 Atomic Report Persisted
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: "18px",
          overflowX: "auto",
        }}
      >
        {[
          { id: "output", label: "Final Output", icon: CheckCircle2 },
          { id: "timeline", label: `Timeline (${orderedNodes.length})`, icon: Clock },
          { id: "nodes", label: `Node Inspector (${nodes.length})`, icon: Layers },
          { id: "trigger", label: "Trigger & Input", icon: Zap },
          { id: "raw", label: "Report JSON", icon: Code2 },
        ].map((tab) => {
          const isAct = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 18px",
                background: "transparent",
                border: "none",
                borderBottom: isAct ? "2px solid var(--brand)" : "2px solid transparent",
                color: isAct ? "var(--text-primary)" : "var(--text-muted)",
                fontSize: "0.82rem",
                fontWeight: isAct ? "700" : "500",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "7px",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={14} color={isAct ? "var(--brand)" : "var(--text-muted)"} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: FINAL OUTPUT */}
      {activeTab === "output" && (
        <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                Persisted Workflow Final Output
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                Extracted and durable result produced by terminal return nodes or the DAG's final stage.
              </p>
            </div>

            {finalOutput !== undefined && finalOutput !== null && (
              <button
                type="button"
                onClick={() => handleCopy(finalOutput, "finalOutput")}
                className="btn btn-secondary"
                style={{ padding: "6px 12px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                {copiedField === "finalOutput" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                {copiedField === "finalOutput" ? "Copied" : "Copy Output"}
              </button>
            )}
          </div>

          {finalOutput !== undefined && finalOutput !== null ? (
            <pre
              style={{
                background: "var(--bg-input)",
                padding: "16px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.82rem",
                fontFamily: "var(--font-mono)",
                color: "var(--text-primary)",
                maxHeight: "500px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                margin: 0,
              }}
            >
              {JSON.stringify(finalOutput, null, 2)}
            </pre>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "0.84rem" }}>
              {isFailed
                ? "This workflow run encountered an error prior to producing a final output value."
                : "No final return value was produced for this execution run."}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXECUTION TIMELINE */}
      {activeTab === "timeline" && (
        <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
          <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "16px" }}>
            Chronological Execution Sequence
          </h3>

          <div style={{ position: "relative", paddingLeft: "24px" }}>
            {/* Vertical timeline spine */}
            <div
              style={{
                position: "absolute",
                left: "8px",
                top: "10px",
                bottom: "10px",
                width: "2px",
                background: "var(--border-subtle)",
              }}
            />

            {/* Run Started event */}
            <div style={{ position: "relative", marginBottom: "20px" }}>
              <div
                style={{
                  position: "absolute",
                  left: "-20px",
                  top: "2px",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: "var(--brand)",
                  boxShadow: "0 0 8px var(--brand)",
                }}
              />
              <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--text-primary)" }}>
                Workflow Execution Initiated
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Triggered via <strong>{run.triggerType || "MANUAL"}</strong> at {formatTimestamp(run.startedAt)}
              </div>
            </div>

            {/* Nodes in chronological order */}
            {orderedNodes.map((n, idx) => {
              const nodeSucceeded = n.status === "SUCCEEDED";
              const nodeFailed = n.status === "FAILED";
              const nodeSkipped = n.status === "SKIPPED" || n.status === "BLOCKED";

              return (
                <div key={n.nodeId || idx} style={{ position: "relative", marginBottom: "18px" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: "-20px",
                      top: "4px",
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: nodeSucceeded
                        ? "#10b981"
                        : nodeFailed
                        ? "#f43f5e"
                        : "var(--text-muted)",
                      boxShadow: nodeSucceeded
                        ? "0 0 6px #10b981"
                        : nodeFailed
                        ? "0 0 6px #f43f5e"
                        : "none",
                    }}
                  />
                  <div
                    style={{
                      padding: "10px 14px",
                      background: "var(--bg-secondary)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: "700", fontSize: "0.82rem", color: "var(--text-primary)" }}>
                          {n.nodeName || n.label || n.nodeId}
                        </span>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                          ({n.nodeType})
                        </span>
                        <span
                          style={{
                            fontSize: "0.65rem",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            fontWeight: "700",
                            background: nodeSucceeded
                              ? "rgba(16, 185, 129, 0.12)"
                              : nodeFailed
                              ? "rgba(244, 63, 94, 0.12)"
                              : "rgba(255, 255, 255, 0.06)",
                            color: nodeSucceeded ? "#10b981" : nodeFailed ? "#f43f5e" : "var(--text-muted)",
                          }}
                        >
                          {n.status}
                        </span>
                      </div>
                      {n.error && (
                        <div style={{ fontSize: "0.72rem", color: "#f43f5e", marginTop: "3px" }}>
                          {typeof n.error === "object" ? n.error.message : String(n.error)}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: "right", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      <div>{n.durationMs !== undefined ? `${n.durationMs} ms` : "—"}</div>
                      {n.completedAt && <div>{formatTimestamp(n.completedAt)}</div>}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Run Finished event */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: "-20px",
                  top: "2px",
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: isSucceeded ? "#10b981" : isFailed ? "#f43f5e" : "var(--brand)",
                  boxShadow: isSucceeded ? "0 0 8px #10b981" : isFailed ? "0 0 8px #f43f5e" : "none",
                }}
              />
              <div style={{ fontSize: "0.82rem", fontWeight: "700", color: isSucceeded ? "#10b981" : isFailed ? "#f43f5e" : "var(--brand)" }}>
                Workflow {run.status}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                Execution completed in {durationMs} ms total
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: NODE INSPECTOR */}
      {activeTab === "nodes" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Node Filter Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            {[
              { id: "all", label: `All (${nodes.length})` },
              { id: "succeeded", label: `Succeeded (${succeededCount})` },
              { id: "failed", label: `Failed (${failedCount})` },
              { id: "skipped", label: `Skipped (${skippedCount})` },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setNodeFilter(f.id)}
                className="btn btn-secondary"
                style={{
                  padding: "5px 12px",
                  fontSize: "0.75rem",
                  background: nodeFilter === f.id ? "var(--brand-light)" : "var(--bg-secondary)",
                  color: nodeFilter === f.id ? "var(--brand)" : "var(--text-secondary)",
                  borderColor: nodeFilter === f.id ? "var(--brand)" : "var(--border-subtle)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Node List Cards */}
          {filteredNodes.length === 0 ? (
            <div className="glass-panel" style={{ padding: "40px", textAlign: "center", borderRadius: "12px" }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                No nodes match the selected filter.
              </p>
            </div>
          ) : (
            filteredNodes.map((node) => {
              const isExp = expandedNodes[node.nodeId];
              const nodeTab = selectedNodeTab[node.nodeId] || "output";
              const isSucc = node.status === "SUCCEEDED";
              const isFail = node.status === "FAILED";
              const isSkip = node.status === "SKIPPED" || node.status === "BLOCKED";

              return (
                <div
                  key={node.nodeId}
                  className="glass-panel"
                  style={{
                    borderRadius: "10px",
                    border: `1px solid ${
                      isFail
                        ? "rgba(244, 63, 94, 0.35)"
                        : isExp
                        ? "var(--brand)"
                        : "var(--border-subtle)"
                    }`,
                    overflow: "hidden",
                    background: "var(--bg-secondary)",
                  }}
                >
                  {/* Node Card Header */}
                  <div
                    onClick={() => toggleNodeExpanded(node.nodeId)}
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {isExp ? <ChevronDown size={15} color="var(--text-muted)" /> : <ChevronRight size={15} color="var(--text-muted)" />}
                      {isSucc && <CheckCircle2 size={16} color="#10b981" />}
                      {isFail && <XCircle size={16} color="#f43f5e" />}
                      {isSkip && <FastForward size={16} color="var(--text-muted)" />}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-primary)" }}>
                            {node.nodeName || node.label || node.nodeId}
                          </span>
                          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            {node.nodeType}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          ID: <code>{node.nodeId}</code>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                        {node.durationMs !== undefined ? `${node.durationMs} ms` : "—"}
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "2px 7px",
                          borderRadius: "4px",
                          fontWeight: "700",
                          background: isSucc
                            ? "rgba(16, 185, 129, 0.12)"
                            : isFail
                            ? "rgba(244, 63, 94, 0.12)"
                            : "rgba(255, 255, 255, 0.05)",
                          color: isSucc ? "#10b981" : isFail ? "#f43f5e" : "var(--text-muted)",
                        }}
                      >
                        {node.status}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Inspector Panel */}
                  {isExp && (
                    <div style={{ borderTop: "1px solid var(--border-subtle)", padding: "14px 16px", background: "rgba(0, 0, 0, 0.15)" }}>
                      {/* Sub-tab switcher: Output vs Input vs Error */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedNodeTab((p) => ({ ...p, [node.nodeId]: "output" }))}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "4px",
                              border: "none",
                              background: nodeTab === "output" ? "var(--brand)" : "var(--bg-input)",
                              color: nodeTab === "output" ? "#ffffff" : "var(--text-muted)",
                              fontSize: "0.72rem",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            Output
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedNodeTab((p) => ({ ...p, [node.nodeId]: "input" }))}
                            style={{
                              padding: "4px 10px",
                              borderRadius: "4px",
                              border: "none",
                              background: nodeTab === "input" ? "var(--brand)" : "var(--bg-input)",
                              color: nodeTab === "input" ? "#ffffff" : "var(--text-muted)",
                              fontSize: "0.72rem",
                              fontWeight: "600",
                              cursor: "pointer",
                            }}
                          >
                            Input
                          </button>
                          {node.error && (
                            <button
                              type="button"
                              onClick={() => setSelectedNodeTab((p) => ({ ...p, [node.nodeId]: "error" }))}
                              style={{
                                padding: "4px 10px",
                                borderRadius: "4px",
                                border: "none",
                                background: nodeTab === "error" ? "#f43f5e" : "var(--bg-input)",
                                color: nodeTab === "error" ? "#ffffff" : "#f43f5e",
                                fontSize: "0.72rem",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                            >
                              Error
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const val = nodeTab === "output" ? (node.output || node.outputs) : (node.input || node.inputs);
                            handleCopy(val, `${node.nodeId}-${nodeTab}`);
                          }}
                          className="btn btn-secondary"
                          style={{ padding: "3px 8px", fontSize: "0.7rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        >
                          {copiedField === `${node.nodeId}-${nodeTab}` ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                          {copiedField === `${node.nodeId}-${nodeTab}` ? "Copied" : `Copy ${nodeTab}`}
                        </button>
                      </div>

                      {/* Content view */}
                      {nodeTab === "output" && (
                        <pre
                          style={{
                            background: "var(--bg-input)",
                            padding: "12px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-primary)",
                            maxHeight: "260px",
                            overflowY: "auto",
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                          }}
                        >
                          {JSON.stringify(node.output !== undefined ? node.output : (node.outputs || "No output recorded"), null, 2)}
                        </pre>
                      )}

                      {nodeTab === "input" && (
                        <pre
                          style={{
                            background: "var(--bg-input)",
                            padding: "12px",
                            borderRadius: "6px",
                            fontSize: "0.75rem",
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-primary)",
                            maxHeight: "260px",
                            overflowY: "auto",
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-all",
                          }}
                        >
                          {JSON.stringify(node.input !== undefined ? node.input : (node.inputs || {}), null, 2)}
                        </pre>
                      )}

                      {nodeTab === "error" && node.error && (
                        <div
                          style={{
                            padding: "12px",
                            background: "rgba(244, 63, 94, 0.1)",
                            border: "1px solid rgba(244, 63, 94, 0.3)",
                            borderRadius: "6px",
                            color: "#f43f5e",
                            fontSize: "0.76rem",
                            fontFamily: "var(--font-mono)",
                          }}
                        >
                          {typeof node.error === "object" ? JSON.stringify(node.error, null, 2) : String(node.error)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 4: TRIGGER & INPUT */}
      {activeTab === "trigger" && (
        <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                Trigger Metadata &amp; Initial Input
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                Sanitized input payload supplied to the workflow at execution commencement.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(run.input || report?.trigger?.input || {}, "triggerInput")}
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              {copiedField === "triggerInput" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              {copiedField === "triggerInput" ? "Copied" : "Copy Payload"}
            </button>
          </div>

          <pre
            style={{
              background: "var(--bg-input)",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.82rem",
              fontFamily: "var(--font-mono)",
              color: "var(--text-primary)",
              maxHeight: "450px",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              margin: 0,
            }}
          >
            {JSON.stringify(run.input || report?.trigger?.input || {}, null, 2)}
          </pre>
        </div>
      )}

      {/* TAB 5: RAW REPORT JSON */}
      {activeTab === "raw" && (
        <div className="glass-panel" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <div>
              <h3 style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                Complete Persisted Execution Report
              </h3>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", margin: "2px 0 0 0" }}>
                Canonical versioned JSON document saved directly in PostgreSQL `WorkflowRun.report`.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(report || run, "rawReport")}
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              {copiedField === "rawReport" ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
              {copiedField === "rawReport" ? "Copied" : "Copy Complete Report"}
            </button>
          </div>

          <pre
            style={{
              background: "var(--bg-input)",
              padding: "16px",
              borderRadius: "8px",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.78rem",
              fontFamily: "var(--font-mono)",
              color: "var(--text-primary)",
              maxHeight: "550px",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              margin: 0,
            }}
          >
            {JSON.stringify(report || run, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
