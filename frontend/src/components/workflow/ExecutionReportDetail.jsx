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

  // Handle live polling/SSE if run is active (PENDING or RUNNING)
  useEffect(() => {
    if (!run || !["PENDING", "RUNNING"].includes(run.status)) return;

    // SSE subscription for live events
    try {
      unsubscribeRef.current = api.subscribeToRunEvents(
        runId,
        (eventType, payload) => {
          if (
            eventType === "workflow:completed" ||
            eventType === "task:succeeded" ||
            eventType === "task:failed" ||
            eventType === "task:skipped" ||
            eventType === "task:blocked" ||
            eventType === "task:running" ||
            eventType === "task:ready"
          ) {
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

    // Polling fallback every 2s while PENDING or RUNNING
    pollIntervalRef.current = setInterval(() => {
      fetchRun(true);
    }, 2000);

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

  // Build task runs lookup map for reliable timings and data
  const taskRunsMap = new Map();
  if (Array.isArray(run?.taskRuns)) {
    for (const t of run.taskRuns) {
      taskRunsMap.set(t.nodeId, t);
    }
  } else if (run?.tasks && typeof run.tasks === "object") {
    for (const [k, v] of Object.entries(run.tasks)) {
      taskRunsMap.set(k, v);
    }
  }

  const rawNodes = Array.isArray(report?.nodes) && report.nodes.length > 0
    ? report.nodes
    : (run?.taskRuns || Object.values(run?.tasks || {}));

  const nodes = rawNodes.map((n) => {
    const fromTask = taskRunsMap.get(n.nodeId || n.id);
    const startedAt = n.startedAt || fromTask?.startedAt || null;
    const completedAt = n.completedAt || n.finishedAt || fromTask?.completedAt || fromTask?.finishedAt || null;

    let durationMs = (n.durationMs !== null && n.durationMs !== undefined)
      ? n.durationMs
      : ((fromTask?.durationMs !== null && fromTask?.durationMs !== undefined)
          ? fromTask.durationMs
          : null);

    if ((durationMs === null || durationMs === undefined) && completedAt && startedAt) {
      const diff = new Date(completedAt).getTime() - new Date(startedAt).getTime();
      if (!isNaN(diff) && diff >= 0) {
        durationMs = diff;
      }
    }
    if ((durationMs === null || durationMs === undefined) && (n.status === "SUCCEEDED" || fromTask?.status === "SUCCEEDED")) {
      durationMs = 0;
    }

    return {
      ...fromTask,
      ...n,
      startedAt,
      completedAt,
      finishedAt: completedAt,
      durationMs,
      input: n.input !== undefined && n.input !== null ? n.input : fromTask?.input,
      inputs: n.inputs !== undefined && n.inputs !== null ? n.inputs : (fromTask?.inputs || fromTask?.input),
      output: n.output !== undefined && n.output !== null ? n.output : fromTask?.output,
      outputs: n.outputs !== undefined && n.outputs !== null ? n.outputs : (fromTask?.outputs || fromTask?.output),
    };
  });

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

  const calculatedRunDuration = (run?.finishedAt && run?.startedAt)
    ? Math.max(0, new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime())
    : 0;

  const durationMs = (run?.durationMs !== null && run?.durationMs !== undefined)
    ? run.durationMs
    : ((report?.execution?.durationMs !== null && report?.execution?.durationMs !== undefined)
      ? report.execution.durationMs
      : calculatedRunDuration);

  const isRunning = run?.status === "RUNNING";
  const isSucceeded = run?.status === "SUCCEEDED";
  const isFailed = run?.status === "FAILED";

  const rawFinalOutput = run?.finalOutput !== undefined && run.finalOutput !== null
    ? run.finalOutput
    : (run?.output !== undefined && run.output !== null
        ? run.output
        : (report?.finalOutput !== undefined && report.finalOutput !== null
            ? report.finalOutput
            : report?.output));

  // If finalOutput was wrapped under a single terminal node id { "nodeId": { ... } }, unnest it
  let finalOutput = rawFinalOutput;
  if (
    finalOutput &&
    typeof finalOutput === "object" &&
    !Array.isArray(finalOutput) &&
    !finalOutput.serviceTelemetry &&
    !finalOutput.aiAnalysis &&
    !finalOutput.result &&
    !finalOutput.output &&
    !finalOutput.actionPlan
  ) {
    const keys = Object.keys(finalOutput);
    if (keys.length === 1 && typeof finalOutput[keys[0]] === "object" && finalOutput[keys[0]] !== null) {
      finalOutput = finalOutput[keys[0]];
    }
  }

  // Helper to extract node output consistently
  const getNodeOutput = (node) => {
    return node?.output !== undefined ? node.output : (node?.outputs !== undefined ? node.outputs : null);
  };

  // Helper to check if a node is an AI node
  const isAiNode = (node) => {
    const out = getNodeOutput(node);
    return Boolean(
      node?.nodeType?.startsWith("ai.") ||
      out?.provider === "groq" ||
      out?._aiExecution ||
      out?.category ||
      out?.leadingHypothesis ||
      (node?.nodeType && (node.nodeType.includes("groq") || node.nodeType.includes("llm") || node.nodeType.includes("classify")))
    );
  };

  // Extract AI Analysis and Service Telemetry if present in final output or node outputs
  const aiNode = nodes.find(isAiNode);
  const aiNodeOutput = aiNode ? getNodeOutput(aiNode) : null;

  const aiAnalysis =
    finalOutput?.aiAnalysis ||
    (aiNodeOutput?.leadingHypothesis || aiNodeOutput?.category
      ? {
        provider: aiNodeOutput.provider || "groq",
        model: aiNodeOutput.model || "llama-3.3-70b-versatile",
        severity: aiNodeOutput.severity || (finalOutput?.severity || "warning"),
        leadingHypothesis: aiNodeOutput.leadingHypothesis || (aiNodeOutput.reasoning || `Classified as ${aiNodeOutput.category}`),
        confidence: aiNodeOutput.confidence !== undefined ? aiNodeOutput.confidence : 0.95,
        alternativeExplanations: aiNodeOutput.alternativeExplanations,
      }
      : null);

  const serviceTelemetry = finalOutput?.serviceTelemetry;
  const actionPlan = finalOutput?.actionPlan || aiNodeOutput?.recommendation || aiNodeOutput?.action;
  const hasAiBriefing = Boolean(finalOutput && (serviceTelemetry || aiAnalysis || finalOutput.aiAnalysis));

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
          border: `1px solid ${isSucceeded
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
                border: `1px solid ${isSucceeded
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
          { id: "output", label: hasAiBriefing ? "Final Output & AI Analysis" : "Final Output", icon: hasAiBriefing ? Sparkles : CheckCircle2 },
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
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Structured Operational Incident & AI Intelligence Briefing Card */}
          {hasAiBriefing && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)",
                border: "1px solid rgba(56, 189, 248, 0.25)",
                borderRadius: "12px",
                padding: "18px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "8px",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
                  paddingBottom: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      background:
                        aiAnalysis?.severity === "critical" || finalOutput?.severity === "critical"
                          ? "rgba(244, 63, 94, 0.2)"
                          : aiAnalysis?.severity === "warning" || finalOutput?.severity === "warning"
                            ? "rgba(245, 158, 11, 0.2)"
                            : "rgba(56, 189, 248, 0.2)",
                      border: `1px solid ${aiAnalysis?.severity === "critical" || finalOutput?.severity === "critical"
                        ? "#f43f5e"
                        : aiAnalysis?.severity === "warning" || finalOutput?.severity === "warning"
                          ? "#f59e0b"
                          : "#38bdf8"
                        }`,
                      color:
                        aiAnalysis?.severity === "critical" || finalOutput?.severity === "critical"
                          ? "#f43f5e"
                          : aiAnalysis?.severity === "warning" || finalOutput?.severity === "warning"
                            ? "#f59e0b"
                            : "#38bdf8",
                      fontSize: "0.78rem",
                      fontWeight: "800",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {aiAnalysis?.severity
                      ? aiAnalysis.severity.toUpperCase()
                      : finalOutput?.severity
                        ? String(finalOutput.severity).toUpperCase()
                        : "INCIDENT REPORT"}
                  </div>
                  <div>
                    <div style={{ fontSize: "1rem", fontWeight: "800", color: "#f8fafc" }}>
                      {finalOutput?.incidentId || finalOutput?.ticketId || "OPERATIONAL BRIEFING"} —{" "}
                      {finalOutput?.service || (aiNode?.nodeName || "Workflow Engine")}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "2px" }}>
                      Region: {finalOutput?.region || "global"} • Tier:{" "}
                      {finalOutput?.customerTier || "standard"} • Generated:{" "}
                      {formatTimestamp(finalOutput?.reportGeneratedAt || run.finishedAt || run.startedAt)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: "12px",
                }}
              >
                {/* Derived Operational Metrics */}
                {(finalOutput?.derivedMetrics || finalOutput?.affectedUsers !== undefined || finalOutput?.errorRate !== undefined) && (
                  <div
                    style={{
                      background: "rgba(0, 0, 0, 0.25)",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: "700",
                        color: "#38bdf8",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      📊 Derived Metrics
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.78rem" }}>
                      {(finalOutput?.derivedMetrics?.impactedVolume !== undefined || finalOutput?.affectedUsers !== undefined) && (
                        <div>
                          Impacted Users:{" "}
                          <strong style={{ color: "#f8fafc" }}>
                            {finalOutput.derivedMetrics?.impactedVolume ?? finalOutput.affectedUsers}
                          </strong>
                        </div>
                      )}
                      {finalOutput?.errorRate !== undefined && (
                        <div>
                          Error Rate:{" "}
                          <strong style={{ color: "#f8fafc" }}>
                            {typeof finalOutput.errorRate === "number" && finalOutput.errorRate <= 1
                              ? `${(finalOutput.errorRate * 100).toFixed(0)}%`
                              : `${finalOutput.errorRate}%`}
                          </strong>
                        </div>
                      )}
                      {finalOutput?.revenueAtRisk !== undefined && (
                        <div>
                          Financial Risk:{" "}
                          <strong style={{ color: "#f8fafc" }}>
                            ${Number(finalOutput.revenueAtRisk).toLocaleString()}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Service Telemetry */}
                {serviceTelemetry && (
                  <div
                    style={{
                      background: "rgba(0, 0, 0, 0.25)",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: "700",
                        color: "#a855f7",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        letterSpacing: "0.5px",
                      }}
                    >
                      <span>📡 Service Telemetry</span>
                      <span style={{ fontSize: "0.62rem", color: "#94a3b8" }}>Observed</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", fontSize: "0.78rem" }}>
                      {serviceTelemetry.p99LatencyMs !== undefined && (
                        <div>
                          P99 Latency:{" "}
                          <strong style={{ color: "#f8fafc" }}>
                            {serviceTelemetry.p99LatencyMs} ms
                          </strong>
                        </div>
                      )}
                      {serviceTelemetry.activePods !== undefined && (
                        <div>
                          Pods:{" "}
                          <strong style={{ color: "#f8fafc" }}>
                            {serviceTelemetry.activePods} active (
                            {serviceTelemetry.unhealthyPods ?? 0} unhealthy)
                          </strong>
                        </div>
                      )}
                      {serviceTelemetry.providerHealth && (
                        <div>
                          Provider Health:{" "}
                          <strong
                            style={{
                              color:
                                serviceTelemetry.providerHealth === "degraded" || serviceTelemetry.providerHealth === "unhealthy"
                                  ? "#f43f5e"
                                  : "#10b981",
                            }}
                          >
                            {serviceTelemetry.providerHealth}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Analysis Hypothesis */}
                {aiAnalysis && (
                  <div
                    style={{
                      background: "rgba(0, 0, 0, 0.25)",
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.05)",
                      gridColumn: "1 / -1",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "0.72rem",
                        fontWeight: "700",
                        color: "#f59e0b",
                        marginBottom: "8px",
                        textTransform: "uppercase",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        letterSpacing: "0.5px",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Sparkles size={13} color="#f59e0b" />
                        <span>
                          AI Hypothesis ({aiAnalysis.provider || "Groq"} / {aiAnalysis.model || "llama-3.3-70b-versatile"})
                        </span>
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "#f59e0b",
                          background: "rgba(245, 158, 11, 0.15)",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          fontWeight: "700",
                        }}
                      >
                        {typeof aiAnalysis.confidence === "number"
                          ? `${Math.round(aiAnalysis.confidence <= 1 ? aiAnalysis.confidence * 100 : aiAnalysis.confidence)}% Confidence`
                          : "95% Confidence"}
                      </span>
                    </div>
                    {aiAnalysis.leadingHypothesis && (
                      <div style={{ fontSize: "0.82rem", color: "#e2e8f0", lineHeight: 1.5, marginBottom: "8px" }}>
                        <strong style={{ color: "#f8fafc" }}>Leading Hypothesis:</strong> {aiAnalysis.leadingHypothesis}
                      </div>
                    )}
                    {Array.isArray(aiAnalysis.alternativeExplanations) && aiAnalysis.alternativeExplanations.length > 0 && (
                      <div style={{ fontSize: "0.74rem", color: "#94a3b8", lineHeight: 1.4 }}>
                        <strong style={{ color: "#cbd5e1" }}>Alternative Explanations:</strong>{" "}
                        {aiAnalysis.alternativeExplanations.join(" • ")}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Plan */}
              {actionPlan && (
                <div
                  style={{
                    background: "rgba(0, 0, 0, 0.35)",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    borderLeft: `4px solid ${aiAnalysis?.severity === "critical" || finalOutput?.severity === "critical"
                      ? "#f43f5e"
                      : aiAnalysis?.severity === "warning" || finalOutput?.severity === "warning"
                        ? "#f59e0b"
                        : "#38bdf8"
                      }`,
                    fontSize: "0.84rem",
                    fontWeight: "600",
                    color: "#f8fafc",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: "#38bdf8", marginRight: "6px", fontWeight: "700" }}>Recommended Action Plan:</span>
                  {actionPlan}
                </div>
              )}
            </div>
          )}

          {/* Raw / Extracted Final Output Box */}
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
                        {isAiNode(n) && (
                          <span
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: "700",
                              color: "#38bdf8",
                              background: "rgba(56, 189, 248, 0.12)",
                              border: "1px solid rgba(56, 189, 248, 0.3)",
                              padding: "1px 6px",
                              borderRadius: "4px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <Sparkles size={10} color="#38bdf8" />
                            Groq AI
                          </span>
                        )}
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
                      <div>{n.durationMs !== undefined && n.durationMs !== null ? `${n.durationMs} ms` : (n.status === "SUCCEEDED" ? "0 ms" : "—")}</div>
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
                    border: `1px solid ${isFail
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
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-primary)" }}>
                            {node.nodeName || node.label || node.nodeId}
                          </span>
                          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            {node.nodeType}
                          </span>
                          {isAiNode(node) && (
                            <span
                              style={{
                                fontSize: "0.68rem",
                                fontWeight: "700",
                                color: "#38bdf8",
                                background: "rgba(56, 189, 248, 0.12)",
                                border: "1px solid rgba(56, 189, 248, 0.3)",
                                padding: "1px 7px",
                                borderRadius: "4px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                              }}
                            >
                              <Sparkles size={11} color="#38bdf8" />
                              Groq AI
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>
                          ID: <code>{node.nodeId}</code>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                        {node.durationMs !== undefined && node.durationMs !== null ? `${node.durationMs} ms` : (node.status === "SUCCEEDED" ? "0 ms" : "—")}
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
                      {/* Groq AI Live Intelligence Callout */}
                      {isAiNode(node) && isSucc && (
                        <div
                          style={{
                            background: "rgba(57, 174, 169, 0.08)",
                            border: "1px solid rgba(57, 174, 169, 0.3)",
                            borderRadius: "8px",
                            padding: "12px 14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            marginBottom: "14px",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", color: "var(--brand)", fontSize: "0.82rem" }}>
                              <Sparkles size={15} color="var(--brand)" />
                              <span>Groq AI Live Intelligence</span>
                            </div>
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                              Model: {getNodeOutput(node)?.model || "llama-3.3-70b-versatile"}
                            </span>
                          </div>

                          {/* Classification Highlights */}
                          {(getNodeOutput(node)?.category || getNodeOutput(node)?.severity || getNodeOutput(node)?.confidence !== undefined) && (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              {getNodeOutput(node)?.category && (
                                <>
                                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Assigned Category:</span>
                                  <span
                                    style={{
                                      fontSize: "0.78rem",
                                      fontWeight: "700",
                                      color: "var(--text-primary)",
                                      background: "var(--bg-card)",
                                      border: "1px solid var(--border-subtle)",
                                      padding: "2px 8px",
                                      borderRadius: "4px",
                                    }}
                                  >
                                    {getNodeOutput(node).category}
                                  </span>
                                </>
                              )}
                              {getNodeOutput(node)?.severity && (
                                <span
                                  style={{
                                    fontSize: "0.7rem",
                                    fontWeight: "700",
                                    color: getNodeOutput(node).severity === "critical" ? "#f43f5e" : getNodeOutput(node).severity === "warning" ? "#f59e0b" : "#10b981",
                                    background: getNodeOutput(node).severity === "critical" ? "rgba(244, 63, 94, 0.15)" : getNodeOutput(node).severity === "warning" ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                                    border: `1px solid ${getNodeOutput(node).severity === "critical" ? "rgba(244, 63, 94, 0.3)" : getNodeOutput(node).severity === "warning" ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                                    padding: "2px 7px",
                                    borderRadius: "4px",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {getNodeOutput(node).severity}
                                </span>
                              )}
                              {typeof getNodeOutput(node)?.confidence === "number" && (
                                <span style={{ fontSize: "0.74rem", color: "#34d399", fontWeight: "700", marginLeft: "auto" }}>
                                  {Math.round(getNodeOutput(node).confidence <= 1 ? getNodeOutput(node).confidence * 100 : getNodeOutput(node).confidence)}% Confidence
                                </span>
                              )}
                            </div>
                          )}

                          {/* Reasoning */}
                          {getNodeOutput(node)?.reasoning && (
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45, background: "rgba(0, 0, 0, 0.25)", padding: "10px 12px", borderRadius: "6px" }}>
                              <strong style={{ color: "var(--text-primary)" }}>Reasoning:</strong> {getNodeOutput(node).reasoning}
                            </div>
                          )}

                          {/* Hypothesis */}
                          {getNodeOutput(node)?.leadingHypothesis && (
                            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.45, background: "rgba(0, 0, 0, 0.25)", padding: "10px 12px", borderRadius: "6px" }}>
                              <strong style={{ color: "var(--text-primary)" }}>Hypothesis:</strong> {getNodeOutput(node).leadingHypothesis}
                            </div>
                          )}
                        </div>
                      )}

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
