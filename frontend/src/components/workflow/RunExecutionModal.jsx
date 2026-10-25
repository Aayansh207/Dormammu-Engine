import React, { useState } from "react";
import { 
  X, 
  Play, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Copy, 
  Check, 
  Clock, 
  Terminal,
  ChevronDown,
  ChevronRight
} from "lucide-react";

export default function RunExecutionModal({
  isOpen,
  onClose,
  workflow,
  onRun,
  isRunning,
  runResult,
}) {
  const [triggerInput, setTriggerInput] = useState("10");
  const [activeTab, setActiveTab] = useState("trigger"); // "trigger" | "results"
  const [copied, setCopied] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({});

  if (!isOpen) return null;

  const handleExecute = () => {
    let parsed = triggerInput;
    try {
      parsed = JSON.parse(triggerInput);
    } catch {
      // If it's a number string
      if (!isNaN(Number(triggerInput)) && triggerInput.trim() !== "") {
        parsed = Number(triggerInput);
      }
    }

    onRun(parsed);
    setActiveTab("results");
  };

  const handleCopyOutput = () => {
    if (!runResult) return;
    const text = typeof runResult.finalOutput === "object"
      ? JSON.stringify(runResult.finalOutput, null, 2)
      : String(runResult.finalOutput);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleNodeExpand = (nodeId) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.9)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
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
                background: "linear-gradient(135deg, #39AEA9, #A2D5AB)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Play size={16} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: "1.05rem", fontWeight: "700" }}>Run Workflow</h3>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {workflow?.name} (v{workflow?.version || 1})
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-secondary)" }}>
          <button
            onClick={() => setActiveTab("trigger")}
            style={{
              flex: 1,
              padding: "10px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "trigger" ? "2px solid var(--brand)" : "2px solid transparent",
              color: activeTab === "trigger" ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: "600",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            1. Trigger Payload
          </button>
          <button
            onClick={() => setActiveTab("results")}
            style={{
              flex: 1,
              padding: "10px",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "results" ? "2px solid var(--brand)" : "2px solid transparent",
              color: activeTab === "results" ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: "600",
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            2. Execution Results
            {runResult && (
              <span style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: runResult.status === "SUCCEEDED" ? "#10b981" : "#f43f5e",
              }} />
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {activeTab === "trigger" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                  Trigger Input Data (JSON or number)
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => setTriggerInput("10")}
                    style={{ fontSize: "0.7rem", padding: "2px 8px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer" }}
                  >
                    Number 10
                  </button>
                  <button
                    onClick={() => setTriggerInput('{"userId": "usr_99", "amount": 250}')}
                    style={{ fontSize: "0.7rem", padding: "2px 8px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer" }}
                  >
                    JSON Object
                  </button>
                </div>
              </div>

              <textarea
                rows={6}
                value={triggerInput}
                onChange={(e) => setTriggerInput(e.target.value)}
                placeholder="Enter input data to pass to manual trigger or data.input..."
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  color: "var(--text-primary)",
                  fontSize: "0.85rem",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                  resize: "vertical",
                }}
              />

              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                💡 Any <code>trigger.manual</code> or <code>data.input</code> nodes in your graph will ingest this payload during execution.
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {isRunning ? (
                <div style={{ textAlign: "center", padding: "40px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                  <Loader2 size={32} color="var(--primary-light)" className="animate-spin" />
                  <span style={{ fontSize: "0.95rem", fontWeight: "600" }}>Executing DAG sequentially...</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Evaluating dependencies &amp; invoking isolated node runtimes</span>
                </div>
              ) : !runResult ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  No execution runs yet. Click "Start Execution" below to run.
                </div>
              ) : (
                <>
                  {/* Status Banner */}
                  <div
                    style={{
                      padding: "12px 16px",
                      borderRadius: "10px",
                      background: runResult.status === "SUCCEEDED" ? "rgba(16, 185, 129, 0.12)" : "rgba(244, 63, 94, 0.12)",
                      border: `1px solid ${runResult.status === "SUCCEEDED" ? "rgba(16, 185, 129, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {runResult.status === "SUCCEEDED" ? (
                        <CheckCircle2 size={20} color="#10b981" />
                      ) : (
                        <XCircle size={20} color="#f43f5e" />
                      )}
                      <div>
                        <div style={{ fontSize: "0.92rem", fontWeight: "700", color: runResult.status === "SUCCEEDED" ? "#10b981" : "#f43f5e" }}>
                          Execution {runResult.status}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          Run ID: {runResult.runId}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      <Clock size={13} />
                      <span>{runResult.durationMs || 0} ms</span>
                    </div>
                  </div>

                  {/* Final Output */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <label style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                        Workflow Final Output
                      </label>
                      <button
                        onClick={handleCopyOutput}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--text-muted)",
                          fontSize: "0.72rem",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                    </div>

                    <pre
                      style={{
                        padding: "12px",
                        background: "rgba(0, 0, 0, 0.45)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "8px",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.82rem",
                        color: runResult.status === "SUCCEEDED" ? "#34d399" : "#fca5a5",
                        overflowX: "auto",
                        maxHeight: "160px",
                      }}
                    >
                      {JSON.stringify(runResult.finalOutput, null, 2)}
                    </pre>
                  </div>

                  {/* Tasks Breakdown */}
                  {runResult.tasks && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <label style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
                        Node Execution Sequence ({Object.keys(runResult.tasks).length} Tasks)
                      </label>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {Object.values(runResult.tasks).map((task) => {
                          const isExpanded = Boolean(expandedNodes[task.nodeId]);
                          const isSuccess = task.status === "SUCCEEDED";

                          return (
                            <div
                              key={task.nodeId}
                              style={{
                                background: "rgba(255, 255, 255, 0.03)",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "8px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                onClick={() => toggleNodeExpand(task.nodeId)}
                                style={{
                                  padding: "8px 12px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  cursor: "pointer",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  {isExpanded ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                                  <span style={{ fontSize: "0.82rem", fontWeight: "600" }}>{task.nodeId}</span>
                                  <code style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>({task.nodeType})</code>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{task.durationMs || 0}ms</span>
                                  <span
                                    style={{
                                      fontSize: "0.68rem",
                                      fontWeight: "700",
                                      color: isSuccess ? "#10b981" : "#f43f5e",
                                      background: isSuccess ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                    }}
                                  >
                                    {task.status}
                                  </span>
                                </div>
                              </div>

                              {isExpanded && (
                                <div style={{ padding: "8px 12px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.04)", background: "rgba(0,0,0,0.2)", fontSize: "0.72rem", fontFamily: "var(--font-mono)" }}>
                                  <div style={{ color: "var(--text-muted)" }}>Outputs:</div>
                                  <pre style={{ color: "#38bdf8", marginTop: "2px" }}>
                                    {JSON.stringify(task.outputs, null, 2)}
                                  </pre>
                                  {task.error && (
                                    <div style={{ marginTop: "6px", color: "#f43f5e" }}>
                                      Error: {task.error.message}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(0,0,0,0.2)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              color: "var(--text-secondary)",
              fontSize: "0.85rem",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Close
          </button>

          <button
            onClick={handleExecute}
            disabled={isRunning}
            style={{
              padding: "8px 20px",
              background: "var(--brand)",
              border: "1px solid var(--brand-border)",
              borderRadius: "var(--radius-sm)",
              color: "#ffffff",
              fontSize: "0.88rem",
              fontWeight: "700",
              cursor: isRunning ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 0 14px var(--brand-glow)",
              opacity: isRunning ? 0.7 : 1,
            }}
          >
            {isRunning ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play size={16} />
                Execute Run
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
