import React, { useState, useEffect } from "react";
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
  ChevronRight,
  Zap,
  Sliders
} from "lucide-react";

export default function RunExecutionModal({
  isOpen,
  onClose,
  workflow,
  onRun,
  isRunning,
  runResult,
}) {
  const manualTriggers = (workflow?.nodes || []).filter((n) => n.type === "trigger.manual");
  const isMultiTrigger = manualTriggers.length >= 2;

  const [triggerInput, setTriggerInput] = useState("10");
  const [multiTriggerMode, setMultiTriggerMode] = useState("per_trigger"); // "per_trigger" | "broadcast"
  const [selectedTriggerId, setSelectedTriggerId] = useState(null);
  const [perTriggerInputs, setPerTriggerInputs] = useState({});
  const [activeTab, setActiveTab] = useState("trigger"); // "trigger" | "results"
  const [copied, setCopied] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({});

  // Synchronize multi-trigger default values whenever modal opens or workflow changes
  useEffect(() => {
    if (!isOpen) return;

    if (manualTriggers.length > 0) {
      if (!selectedTriggerId || !manualTriggers.find((t) => t.id === selectedTriggerId)) {
        setSelectedTriggerId(manualTriggers[0].id);
      }

      setPerTriggerInputs((prev) => {
        const next = { ...prev };
        manualTriggers.forEach((trig, idx) => {
          if (next[trig.id] === undefined) {
            if (trig.config?.defaultPayload !== undefined && Object.keys(trig.config.defaultPayload).length > 0) {
              next[trig.id] = typeof trig.config.defaultPayload === "object"
                ? JSON.stringify(trig.config.defaultPayload, null, 2)
                : String(trig.config.defaultPayload);
            } else {
              next[trig.id] = String((idx + 1) * 10);
            }
          }
        });
        return next;
      });
    }
  }, [isOpen, workflow?.nodes?.length]);

  if (!isOpen) return null;

  const handleExecute = () => {
    let payloadToSend;

    if (isMultiTrigger && multiTriggerMode === "per_trigger") {
      const multiPayload = { $multiTrigger: true };
      for (const trig of manualTriggers) {
        const raw = perTriggerInputs[trig.id];
        let val;
        if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
          try {
            val = JSON.parse(raw);
          } catch {
            if (!isNaN(Number(raw))) {
              val = Number(raw);
            } else {
              val = raw;
            }
          }
        } else if (trig.config?.defaultPayload !== undefined) {
          val = trig.config.defaultPayload;
        } else {
          val = {};
        }

        multiPayload[trig.id] = val;
        if (trig.config?.triggerKey && trig.config.triggerKey.trim() !== "") {
          multiPayload[trig.config.triggerKey] = val;
        }
      }
      payloadToSend = multiPayload;
    } else {
      let parsed = triggerInput;
      try {
        parsed = JSON.parse(triggerInput);
      } catch {
        if (!isNaN(Number(triggerInput)) && triggerInput.trim() !== "") {
          parsed = Number(triggerInput);
        }
      }
      payloadToSend = parsed;
    }

    onRun(payloadToSend);
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
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Multi-Trigger Arrangement Banner */}
              {isMultiTrigger ? (
                <div
                  style={{
                    background: "rgba(57, 174, 169, 0.08)",
                    border: "1px solid var(--brand-border)",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Zap size={16} color="var(--brand)" />
                      <div>
                        <div style={{ fontSize: "0.84rem", fontWeight: "700", color: "var(--text-primary)" }}>
                          {manualTriggers.length} Manual Triggers Configured
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          Target independent inputs to each trigger or broadcast a shared payload
                        </div>
                      </div>
                    </div>

                    {/* Mode Toggle */}
                    <div style={{ display: "flex", background: "var(--bg-secondary)", borderRadius: "6px", padding: "2px", border: "1px solid var(--border-subtle)" }}>
                      <button
                        type="button"
                        onClick={() => setMultiTriggerMode("per_trigger")}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "4px",
                          border: "none",
                          fontSize: "0.72rem",
                          fontWeight: "700",
                          background: multiTriggerMode === "per_trigger" ? "var(--brand)" : "transparent",
                          color: multiTriggerMode === "per_trigger" ? "#ffffff" : "var(--text-muted)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Sliders size={12} />
                        Per-Trigger
                      </button>
                      <button
                        type="button"
                        onClick={() => setMultiTriggerMode("broadcast")}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "4px",
                          border: "none",
                          fontSize: "0.72rem",
                          fontWeight: "700",
                          background: multiTriggerMode === "broadcast" ? "var(--brand)" : "transparent",
                          color: multiTriggerMode === "broadcast" ? "#ffffff" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        Broadcast
                      </button>
                    </div>
                  </div>

                  {multiTriggerMode === "per_trigger" && (
                    <>
                      {/* Trigger Tab Selector */}
                      <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }}>
                        {manualTriggers.map((trig, idx) => {
                          const isSel = selectedTriggerId === trig.id;
                          return (
                            <button
                              key={trig.id}
                              type="button"
                              onClick={() => setSelectedTriggerId(trig.id)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "8px",
                                border: `1px solid ${isSel ? "var(--brand-border)" : "var(--border-subtle)"}`,
                                background: isSel ? "var(--brand-light)" : "var(--bg-card)",
                                color: isSel ? "var(--brand)" : "var(--text-secondary)",
                                fontWeight: isSel ? "700" : "500",
                                fontSize: "0.78rem",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <span
                                style={{
                                  width: "18px",
                                  height: "18px",
                                  borderRadius: "50%",
                                  background: isSel ? "var(--brand)" : "rgba(255,255,255,0.08)",
                                  color: isSel ? "#ffffff" : "var(--text-muted)",
                                  fontSize: "0.68rem",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: "700",
                                }}
                              >
                                {idx + 1}
                              </span>
                              <span>{trig.name || trig.id}</span>
                              {trig.config?.triggerKey && (
                                <span style={{ fontSize: "0.65rem", opacity: 0.7, fontFamily: "var(--font-mono)" }}>
                                  ({trig.config.triggerKey})
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Selected Trigger Input Box */}
                      {selectedTriggerId && (() => {
                        const activeTrig = manualTriggers.find((t) => t.id === selectedTriggerId) || manualTriggers[0];
                        const activeVal = perTriggerInputs[activeTrig.id] ?? "";

                        return (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-primary)" }}>
                                  Payload for {activeTrig.name || activeTrig.id}
                                </span>
                                <span style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", background: "rgba(255,255,255,0.05)", padding: "1px 6px", borderRadius: "4px" }}>
                                  ID: {activeTrig.id}
                                </span>
                              </div>

                              <div style={{ display: "flex", gap: "5px" }}>
                                <button
                                  type="button"
                                  onClick={() => setPerTriggerInputs((p) => ({ ...p, [activeTrig.id]: "10" }))}
                                  style={{ fontSize: "0.7rem", padding: "2px 7px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer" }}
                                >
                                  10
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPerTriggerInputs((p) => ({ ...p, [activeTrig.id]: "25" }))}
                                  style={{ fontSize: "0.7rem", padding: "2px 7px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer" }}
                                >
                                  25
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPerTriggerInputs((p) => ({ ...p, [activeTrig.id]: JSON.stringify({ item: activeTrig.id, value: 100 }, null, 2) }))}
                                  style={{ fontSize: "0.7rem", padding: "2px 7px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer" }}
                                >
                                  JSON
                                </button>
                                {activeTrig.config?.defaultPayload !== undefined && (
                                  <button
                                    type="button"
                                    onClick={() => setPerTriggerInputs((p) => ({
                                      ...p,
                                      [activeTrig.id]: typeof activeTrig.config.defaultPayload === "object"
                                        ? JSON.stringify(activeTrig.config.defaultPayload, null, 2)
                                        : String(activeTrig.config.defaultPayload),
                                    }))}
                                    style={{ fontSize: "0.7rem", padding: "2px 7px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--brand)", cursor: "pointer" }}
                                  >
                                    Default
                                  </button>
                                )}
                              </div>
                            </div>

                            <textarea
                              rows={5}
                              value={activeVal}
                              onChange={(e) => setPerTriggerInputs((prev) => ({ ...prev, [activeTrig.id]: e.target.value }))}
                              placeholder={`Enter custom payload for ${activeTrig.name || activeTrig.id}...`}
                              style={{
                                width: "100%",
                                padding: "10px",
                                background: "var(--bg-input)",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "8px",
                                color: "var(--text-primary)",
                                fontSize: "0.82rem",
                                fontFamily: "var(--font-mono)",
                                outline: "none",
                                resize: "vertical",
                              }}
                            />
                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                              Targeted directly to <code>{activeTrig.id}</code> on execution. Other triggers use their respective payloads.
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>
              ) : null}

              {/* Broadcast or Single-Trigger Input View */}
              {(!isMultiTrigger || multiTriggerMode === "broadcast") && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                      {isMultiTrigger ? "Broadcast Payload (Passed to all triggers)" : "Trigger Input Data (JSON or number)"}
                    </label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => setTriggerInput("10")}
                        style={{ fontSize: "0.7rem", padding: "2px 8px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer" }}
                      >
                        Number 10
                      </button>
                      <button
                        type="button"
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
                    placeholder="Enter input data to pass to trigger nodes..."
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
                    {isMultiTrigger
                      ? `📢 This payload will be broadcasted to all ${manualTriggers.length} manual trigger nodes simultaneously.`
                      : "💡 Any trigger.manual or data.input nodes in your graph will ingest this payload during execution."}
                  </div>
                </div>
              )}
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

                  {/* Multi-Trigger Ingestion Summary in Results */}
                  {isMultiTrigger && runResult?.tasks && (
                    <div
                      style={{
                        background: "rgba(57, 174, 169, 0.08)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "10px",
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--brand)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Zap size={13} /> Trigger Task Ingestions ({manualTriggers.length})
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "8px" }}>
                        {manualTriggers.map((trig) => {
                          const task = runResult.tasks?.[trig.id];
                          return (
                            <div
                              key={trig.id}
                              style={{
                                background: "var(--bg-card)",
                                padding: "8px 10px",
                                borderRadius: "6px",
                                border: "1px solid var(--border-subtle)",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                                <span style={{ fontSize: "0.75rem", fontWeight: "600" }}>{trig.name || trig.id}</span>
                                <span style={{ fontSize: "0.68rem", fontWeight: "700", color: task?.status === "SUCCEEDED" ? "#10b981" : "var(--text-muted)" }}>
                                  {task?.status || "PENDING"}
                                </span>
                              </div>
                              <div style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                Output: {task?.outputs?.output !== undefined ? JSON.stringify(task.outputs.output) : "—"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

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
                                  {(() => {
                                    const badgeStyles = {
                                      SUCCEEDED: { color: "#10b981", bg: "rgba(16, 185, 129, 0.15)" },
                                      FAILED: { color: "#f43f5e", bg: "rgba(244, 63, 94, 0.15)" },
                                      SKIPPED: { color: "#9ca3af", bg: "rgba(156, 163, 175, 0.15)" },
                                      BLOCKED: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" },
                                      CANCELLED: { color: "#c084fc", bg: "rgba(192, 132, 252, 0.15)" },
                                      RUNNING: { color: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)" },
                                    };
                                    const s = badgeStyles[task.status] || { color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)" };
                                    return (
                                      <span
                                        style={{
                                          fontSize: "0.68rem",
                                          fontWeight: "700",
                                          color: s.color,
                                          background: s.bg,
                                          padding: "1px 6px",
                                          borderRadius: "4px",
                                        }}
                                      >
                                        {task.status}
                                      </span>
                                    );
                                  })()}
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
