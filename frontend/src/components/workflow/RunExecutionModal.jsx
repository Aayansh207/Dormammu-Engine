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
  Sliders,
  Sparkles,
  Ban,
  FastForward,
  Slash,
  AlertCircle
} from "lucide-react";


export default function RunExecutionModal({
  isOpen,
  onClose,
  workflow,
  onRun,
  isRunning,
  runResult,
  onOpenAutoTrigger,
}) {
  const allNodes = workflow?.nodes || workflow?.definition?.nodes || [];
  const allEdges = workflow?.edges || workflow?.definition?.edges || [];
  const manualTriggers = allNodes.filter((n) => n.type === "trigger.manual" || n.type === "data.input");
  const isMultiTrigger = manualTriggers.length >= 2;
  const [triggerInput, setTriggerInput] = useState("10");
  const [multiTriggerMode, setMultiTriggerMode] = useState("per_trigger"); // "per_trigger" | "broadcast"
  const [selectedTriggerId, setSelectedTriggerId] = useState(null);
  const [perTriggerInputs, setPerTriggerInputs] = useState({});
  const [activeTab, setActiveTab] = useState("trigger"); // "trigger" | "results"
  const [copied, setCopied] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [taskTabs, setTaskTabs] = useState({}); // taskId -> "outputs" | "inputs" | "raw"
  const [copiedTaskId, setCopiedTaskId] = useState(null);

  // Helper to resolve edge target info for a trigger
  const getTriggerTargetInfo = (trigId) => {
    const edge = allEdges.find((e) => e.source === trigId);
    if (!edge) return null;
    const targetNode = allNodes.find((n) => n.id === edge.target);
    return {
      targetId: edge.target,
      targetName: targetNode?.name || edge.target,
      targetPort: edge.targetPort || "input",
      targetType: targetNode?.type,
    };
  };

  // Initialize input data on modal open
  useEffect(() => {
    if (!isOpen) return;
    const defaultPayload = workflow?.samplePayload ||
      workflow?.definition?.samplePayload ||
      manualTriggers[0]?.config?.defaultPayload ||
      manualTriggers[0]?.config?.defaultValue;

    if (defaultPayload !== undefined && defaultPayload !== null && defaultPayload !== "") {
      if (typeof defaultPayload === "object") {
        setTriggerInput(Object.keys(defaultPayload).length > 0 ? JSON.stringify(defaultPayload, null, 2) : "10");
      } else {
        setTriggerInput(String(defaultPayload));
      }
    } else {
      setTriggerInput("10");
    }
  }, [isOpen, workflow?.id, workflow?.version]);

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
          // If not populated or previously empty object
          if (next[trig.id] === undefined || next[trig.id] === "{}" || next[trig.id] === "") {
            const configuredVal = trig.config?.defaultPayload !== undefined && trig.config.defaultPayload !== ""
              ? trig.config.defaultPayload
              : trig.config?.defaultValue;

            if (configuredVal !== undefined && configuredVal !== null && configuredVal !== "") {
              if (typeof configuredVal === "object") {
                next[trig.id] = Object.keys(configuredVal).length > 0
                  ? JSON.stringify(configuredVal, null, 2)
                  : String((idx + 1) * 10);
              } else {
                next[trig.id] = String(configuredVal);
              }
            } else {
              next[trig.id] = String((idx + 1) * 10);
            }
          }
        });
        return next;
      });
    }
  }, [isOpen, workflow?.id, workflow?.version, manualTriggers.length]);

  if (!isOpen) return null;

  const handleExecute = () => {
    let payloadToSend;

    if (isMultiTrigger && multiTriggerMode === "per_trigger") {
      const multiPayload = { $multiTrigger: true, $triggerIds: [], $triggers: [] };
      const nameCounts = {};
      manualTriggers.forEach((t) => {
        if (t.name) nameCounts[t.name] = (nameCounts[t.name] || 0) + 1;
      });

      manualTriggers.forEach((trig, idx) => {
        const raw = perTriggerInputs[trig.id];
        let val;
        if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
          const trimmed = String(raw).trim();
          try {
            val = JSON.parse(trimmed);
          } catch {
            if (!isNaN(Number(trimmed))) {
              val = Number(trimmed);
            } else {
              val = trimmed;
            }
          }
        } else if (trig.config?.defaultPayload !== undefined && trig.config.defaultPayload !== "") {
          val = trig.config.defaultPayload;
        } else if (trig.config?.defaultValue !== undefined && trig.config.defaultValue !== "") {
          val = trig.config.defaultValue;
        } else {
          val = (idx + 1) * 10;
        }

        // If string representation of a clean number, coerce to number
        if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val))) {
          val = Number(val);
        }

        multiPayload[trig.id] = val;
        multiPayload[`trigger_${idx}`] = val;
        multiPayload.$triggerIds.push(trig.id);
        multiPayload.$triggers.push(val);

        if (trig.config?.triggerKey && trig.config.triggerKey.trim() !== "") {
          multiPayload[trig.config.triggerKey] = val;
        }
        if (trig.config?.key && trig.config.key.trim() !== "") {
          multiPayload[trig.config.key] = val;
        }
        if (trig.name && nameCounts[trig.name] === 1) {
          multiPayload[trig.name] = val;
        }
      });
      payloadToSend = multiPayload;
    } else {
      let parsed = triggerInput;
      if (typeof triggerInput === "string") {
        const trimmed = triggerInput.trim();
        if (trimmed === "") {
          const cfg = manualTriggers[0]?.config?.defaultPayload !== undefined && manualTriggers[0]?.config?.defaultPayload !== ""
            ? manualTriggers[0].config.defaultPayload
            : manualTriggers[0]?.config?.defaultValue;
          parsed = cfg !== undefined ? cfg : 10;
        } else {
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            if (!isNaN(Number(trimmed))) {
              parsed = Number(trimmed);
            } else {
              parsed = trimmed;
            }
          }
        }
      }
      if (typeof parsed === "string" && parsed.trim() !== "" && !isNaN(Number(parsed))) {
        parsed = Number(parsed);
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
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {manualTriggers.map((trig, idx) => {
                        const targetInfo = getTriggerTargetInfo(trig.id);
                        const activeVal = perTriggerInputs[trig.id] ?? String((idx + 1) * 10);

                        return (
                          <div
                            key={trig.id}
                            style={{
                              background: "var(--bg-card)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: "10px",
                              padding: "12px 14px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span
                                  style={{
                                    width: "22px",
                                    height: "22px",
                                    borderRadius: "50%",
                                    background: "var(--brand)",
                                    color: "#ffffff",
                                    fontSize: "0.74rem",
                                    fontWeight: "800",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {idx + 1}
                                </span>
                                <div>
                                  <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                                    <span>{trig.name || trig.id}</span>
                                    <span style={{ fontSize: "0.68rem", fontFamily: "var(--font-mono)", color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: "4px" }}>
                                      {trig.id}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Target port information badge */}
                              {targetInfo && (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    fontSize: "0.72rem",
                                    color: "var(--brand)",
                                    background: "var(--brand-light)",
                                    border: "1px solid var(--brand-border)",
                                    padding: "2px 8px",
                                    borderRadius: "12px",
                                    fontWeight: "600",
                                  }}
                                >
                                  <Zap size={12} />
                                  <span>Feeds: <strong>{targetInfo.targetName}</strong> [port: <code>{targetInfo.targetPort}</code>]</span>
                                </div>
                              )}

                              {/* Quick Presets */}
                              <div style={{ display: "flex", gap: "4px" }}>
                                <button
                                  type="button"
                                  onClick={() => setPerTriggerInputs((p) => ({ ...p, [trig.id]: "10" }))}
                                  style={{ fontSize: "0.68rem", padding: "2px 6px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-secondary)", cursor: "pointer" }}
                                >
                                  10
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPerTriggerInputs((p) => ({ ...p, [trig.id]: "20" }))}
                                  style={{ fontSize: "0.68rem", padding: "2px 6px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-secondary)", cursor: "pointer" }}
                                >
                                  20
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPerTriggerInputs((p) => ({ ...p, [trig.id]: "25" }))}
                                  style={{ fontSize: "0.68rem", padding: "2px 6px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-secondary)", cursor: "pointer" }}
                                >
                                  25
                                </button>
                                {trig.config?.defaultPayload !== undefined && trig.config?.defaultPayload !== "" && (
                                  <button
                                    type="button"
                                    onClick={() => setPerTriggerInputs((p) => ({
                                      ...p,
                                      [trig.id]: typeof trig.config.defaultPayload === "object"
                                        ? JSON.stringify(trig.config.defaultPayload, null, 2)
                                        : String(trig.config.defaultPayload),
                                    }))}
                                    style={{ fontSize: "0.68rem", padding: "2px 6px", background: "var(--bg-chip)", border: "1px solid var(--brand-border)", borderRadius: "4px", color: "var(--brand)", cursor: "pointer" }}
                                  >
                                    Default
                                  </button>
                                )}
                              </div>
                            </div>

                            <input
                              type="text"
                              value={activeVal}
                              onChange={(e) => setPerTriggerInputs((prev) => ({ ...prev, [trig.id]: e.target.value }))}
                              placeholder={`Enter numeric value or JSON for ${trig.name || trig.id}...`}
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                background: "var(--bg-input)",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: "6px",
                                color: "var(--text-primary)",
                                fontSize: "0.85rem",
                                fontFamily: "var(--font-mono)",
                                outline: "none",
                              }}
                            />
                          </div>
                        );
                      })}

                      {/* Summary Banner */}
                      <div
                        style={{
                          background: "rgba(57, 174, 169, 0.09)",
                          border: "1px solid var(--brand-border)",
                          borderRadius: "8px",
                          padding: "8px 12px",
                          fontSize: "0.74rem",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <Sparkles size={14} color="var(--brand)" />
                        <span>
                          <strong>Run Coordination:</strong>{" "}
                          {manualTriggers.map((t, i) => {
                            const tgt = getTriggerTargetInfo(t.id);
                            const val = perTriggerInputs[t.id] ?? (i + 1) * 10;
                            return `Trigger ${i + 1} (${val}) → ${tgt ? `${tgt.targetName}.${tgt.targetPort}` : t.id}`;
                          }).join("  •  ")}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Broadcast or Single-Trigger Input View */}
              {(!isMultiTrigger || multiTriggerMode === "broadcast") && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                    <label style={{ fontSize: "0.82rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                      {isMultiTrigger ? "Broadcast Payload (Passed to all triggers)" : "Trigger Input Data (JSON or number)"}
                    </label>
                    <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Presets:</span>
                      <button
                        type="button"
                        onClick={() => setTriggerInput("10")}
                        style={{ fontSize: "0.7rem", padding: "2px 7px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer" }}
                      >
                        10
                      </button>
                      <button
                        type="button"
                        onClick={() => setTriggerInput("25")}
                        style={{ fontSize: "0.7rem", padding: "2px 7px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer" }}
                      >
                        25
                      </button>
                      <button
                        type="button"
                        onClick={() => setTriggerInput(JSON.stringify({
                          incident_id: "INC-8092",
                          service: "payment-gateway",
                          errorRate: 0.12,
                          affectedUsers: 1400,
                          severity: "warning"
                        }, null, 2))}
                        style={{ fontSize: "0.7rem", padding: "2px 7px", background: "rgba(57, 174, 169, 0.15)", border: "1px solid var(--brand-border)", borderRadius: "4px", color: "var(--brand)", cursor: "pointer", fontWeight: "600" }}
                      >
                        Incident
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            const parsed = JSON.parse(triggerInput);
                            setTriggerInput(JSON.stringify(parsed, null, 2));
                          } catch {
                            // ignore syntax error
                          }
                        }}
                        style={{ fontSize: "0.7rem", padding: "2px 7px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-secondary)", cursor: "pointer" }}
                      >
                        Format
                      </button>
                      <button
                        type="button"
                        onClick={() => setTriggerInput("{}")}
                        style={{ fontSize: "0.7rem", padding: "2px 7px", background: "var(--bg-chip)", border: "1px solid var(--border-subtle)", borderRadius: "4px", color: "var(--text-muted)", cursor: "pointer" }}
                      >
                        Clear
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

                    {onOpenAutoTrigger && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "10px 14px",
                          background: "linear-gradient(135deg, rgba(57, 174, 169, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)",
                          border: "1px solid rgba(57, 174, 169, 0.3)",
                          borderRadius: "8px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Clock size={16} color="var(--brand)" />
                          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                            Want this incident to trigger automatically at specific intervals?
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenAutoTrigger();
                          }}
                          style={{
                            padding: "4px 10px",
                            background: "var(--brand-light)",
                            border: "1px solid var(--brand-border)",
                            borderRadius: "6px",
                            color: "var(--brand)",
                            fontSize: "0.74rem",
                            fontWeight: "700",
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Auto-Trigger Settings →
                        </button>
                      </div>
                    )}
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

                  {/* Structured Operational Incident Report Card */}
                  {runResult.finalOutput && (runResult.finalOutput.serviceTelemetry || runResult.finalOutput.aiAnalysis) && (
                    <div
                      style={{
                        background: "linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)",
                        border: "1px solid rgba(56, 189, 248, 0.25)",
                        borderRadius: "12px",
                        padding: "16px",
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
                          paddingBottom: "10px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              background:
                                runResult.finalOutput.aiAnalysis?.severity === "critical"
                                  ? "rgba(244, 63, 94, 0.2)"
                                  : runResult.finalOutput.aiAnalysis?.severity === "warning"
                                  ? "rgba(245, 158, 11, 0.2)"
                                  : "rgba(56, 189, 248, 0.2)",
                              border: `1px solid ${
                                runResult.finalOutput.aiAnalysis?.severity === "critical"
                                  ? "#f43f5e"
                                  : runResult.finalOutput.aiAnalysis?.severity === "warning"
                                  ? "#f59e0b"
                                  : "#38bdf8"
                              }`,
                              color:
                                runResult.finalOutput.aiAnalysis?.severity === "critical"
                                  ? "#f43f5e"
                                  : runResult.finalOutput.aiAnalysis?.severity === "warning"
                                  ? "#f59e0b"
                                  : "#38bdf8",
                              fontSize: "0.78rem",
                              fontWeight: "800",
                              letterSpacing: "0.5px",
                            }}
                          >
                            {runResult.finalOutput.aiAnalysis?.severity
                              ? runResult.finalOutput.aiAnalysis.severity.toUpperCase()
                              : "INCIDENT"}
                          </div>
                          <div>
                            <div style={{ fontSize: "0.98rem", fontWeight: "800", color: "#f8fafc" }}>
                              {runResult.finalOutput.incidentId || runResult.finalOutput.ticketId || "INCIDENT REPORT"} —{" "}
                              {runResult.finalOutput.service || "service"}
                            </div>
                            <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                              Region: {runResult.finalOutput.region || "global"} • Tier:{" "}
                              {runResult.finalOutput.customerTier || "standard"} • Generated:{" "}
                              {runResult.finalOutput.reportGeneratedAt || new Date().toISOString()}
                            </div>
                          </div>
                        </div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "#10b981",
                            background: "rgba(16, 185, 129, 0.12)",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontWeight: "700",
                            border: "1px solid rgba(16, 185, 129, 0.25)",
                          }}
                        >
                          {runResult.finalOutput.status || "INVESTIGATION COMPLETE"}
                        </div>
                      </div>

                      {/* Metrics Grid */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                          gap: "10px",
                        }}
                      >
                        {/* Derived Calculations */}
                        <div
                          style={{
                            background: "rgba(0, 0, 0, 0.25)",
                            padding: "10px 12px",
                            borderRadius: "8px",
                            border: "1px solid rgba(255, 255, 255, 0.05)",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: "700",
                              color: "#38bdf8",
                              marginBottom: "6px",
                              textTransform: "uppercase",
                            }}
                          >
                            📊 Derived Metrics
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.76rem" }}>
                            <div>
                              Impacted Users:{" "}
                              <strong style={{ color: "#f8fafc" }}>
                                {runResult.finalOutput.derivedMetrics?.impactedVolume ?? runResult.finalOutput.affectedUsers}
                              </strong>
                            </div>
                            <div>
                              Error Rate:{" "}
                              <strong style={{ color: "#f8fafc" }}>
                                {((runResult.finalOutput.errorRate || 0) * 100).toFixed(0)}%
                              </strong>
                            </div>
                            <div>
                              Financial Risk:{" "}
                              <strong style={{ color: "#f8fafc" }}>
                                ${(runResult.finalOutput.revenueAtRisk || 0).toLocaleString()}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Service Telemetry */}
                        {runResult.finalOutput.serviceTelemetry && (
                          <div
                            style={{
                              background: "rgba(0, 0, 0, 0.25)",
                              padding: "10px 12px",
                              borderRadius: "8px",
                              border: "1px solid rgba(255, 255, 255, 0.05)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: "700",
                                color: "#a855f7",
                                marginBottom: "6px",
                                textTransform: "uppercase",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <span>📡 Telemetry (Mock)</span>
                              <span style={{ fontSize: "0.62rem", color: "#94a3b8" }}>Simulated</span>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.76rem" }}>
                              <div>
                                P99 Latency:{" "}
                                <strong style={{ color: "#f8fafc" }}>
                                  {runResult.finalOutput.serviceTelemetry.p99LatencyMs} ms
                                </strong>
                              </div>
                              <div>
                                Pods:{" "}
                                <strong style={{ color: "#f8fafc" }}>
                                  {runResult.finalOutput.serviceTelemetry.activePods} active (
                                  {runResult.finalOutput.serviceTelemetry.unhealthyPods} unhealthy)
                                </strong>
                              </div>
                              <div>
                                Provider:{" "}
                                <strong
                                  style={{
                                    color:
                                      runResult.finalOutput.serviceTelemetry.providerHealth === "degraded"
                                        ? "#f43f5e"
                                        : "#10b981",
                                  }}
                                >
                                  {runResult.finalOutput.serviceTelemetry.providerHealth}
                                </strong>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* AI Analysis */}
                        {runResult.finalOutput.aiAnalysis && (
                          <div
                            style={{
                              background: "rgba(0, 0, 0, 0.25)",
                              padding: "10px 12px",
                              borderRadius: "8px",
                              border: "1px solid rgba(255, 255, 255, 0.05)",
                              gridColumn: "span 2",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "0.72rem",
                                fontWeight: "700",
                                color: "#f59e0b",
                                marginBottom: "6px",
                                textTransform: "uppercase",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <span>
                                🤖 AI Hypothesis ({runResult.finalOutput.aiAnalysis.provider} /{" "}
                                {runResult.finalOutput.aiAnalysis.model})
                              </span>
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  color: "#f59e0b",
                                  background: "rgba(245, 158, 11, 0.15)",
                                  padding: "1px 6px",
                                  borderRadius: "3px",
                                }}
                              >
                                {((runResult.finalOutput.aiAnalysis.confidence || 0.95) * 100).toFixed(0)}% Confidence
                              </span>
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#e2e8f0", lineHeight: 1.4, marginBottom: "6px" }}>
                              <strong>Leading Hypothesis:</strong> {runResult.finalOutput.aiAnalysis.leadingHypothesis}
                            </div>
                            {Array.isArray(runResult.finalOutput.aiAnalysis.alternativeExplanations) && (
                              <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                                <strong>Alternative Explanations:</strong>{" "}
                                {runResult.finalOutput.aiAnalysis.alternativeExplanations.join(" • ")}
                              </div>
                            )}
                            <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "4px", fontStyle: "italic" }}>
                              ⚠️ Root cause unconfirmed: generated hypothesis requires human verification before production rollback.
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Plan */}
                      {runResult.finalOutput.actionPlan && (
                        <div
                          style={{
                            background: "rgba(0, 0, 0, 0.35)",
                            padding: "10px 14px",
                            borderRadius: "8px",
                            borderLeft: `4px solid ${
                              runResult.finalOutput.aiAnalysis?.severity === "critical"
                                ? "#f43f5e"
                                : runResult.finalOutput.aiAnalysis?.severity === "warning"
                                ? "#f59e0b"
                                : "#38bdf8"
                            }`,
                            fontSize: "0.82rem",
                            fontWeight: "600",
                            color: "#f8fafc",
                          }}
                        >
                          {runResult.finalOutput.actionPlan}
                        </div>
                      )}
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

                  {/* Tasks Breakdown - Comprehensive Node Execution Box Sequence */}
                  {runResult.tasks && (() => {
                    const tasksList = Object.values(runResult.tasks);
                    const succeededCount = tasksList.filter((t) => t.status === "SUCCEEDED").length;
                    const failedCount = tasksList.filter((t) => t.status === "FAILED").length;
                    const skippedCount = tasksList.filter((t) => t.status === "SKIPPED").length;
                    const blockedCount = tasksList.filter((t) => t.status === "BLOCKED").length;

                    const allExpanded = tasksList.every((t) => Boolean(expandedNodes[t.nodeId]));
                    const handleToggleAll = () => {
                      if (allExpanded) {
                        setExpandedNodes({});
                      } else {
                        const next = {};
                        tasksList.forEach((t) => { next[t.nodeId] = true; });
                        setExpandedNodes(next);
                      }
                    };

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Terminal size={14} color="var(--brand)" />
                            <label style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              Node Execution Sequence ({tasksList.length} Nodes)
                            </label>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {/* Summary Chips */}
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "0.7rem", fontFamily: "var(--font-mono)" }}>
                              <span style={{ color: "#10b981", background: "rgba(16, 185, 129, 0.12)", padding: "2px 6px", borderRadius: "4px" }}>
                                {succeededCount} Pass
                              </span>
                              {failedCount > 0 && (
                                <span style={{ color: "#f43f5e", background: "rgba(244, 63, 94, 0.12)", padding: "2px 6px", borderRadius: "4px" }}>
                                  {failedCount} Fail
                                </span>
                              )}
                              {skippedCount > 0 && (
                                <span style={{ color: "#9ca3af", background: "rgba(156, 163, 175, 0.12)", padding: "2px 6px", borderRadius: "4px" }}>
                                  {skippedCount} Skipped
                                </span>
                              )}
                              {blockedCount > 0 && (
                                <span style={{ color: "#f59e0b", background: "rgba(245, 158, 11, 0.12)", padding: "2px 6px", borderRadius: "4px" }}>
                                  {blockedCount} Blocked
                                </span>
                              )}
                            </div>

                            <button
                              onClick={handleToggleAll}
                              style={{
                                background: "transparent",
                                border: "1px solid var(--border-subtle)",
                                color: "var(--text-secondary)",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "0.7rem",
                                fontWeight: "600",
                                cursor: "pointer",
                              }}
                            >
                              {allExpanded ? "Collapse All" : "Expand All"}
                            </button>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {tasksList.map((task) => {
                            const isExpanded = Boolean(expandedNodes[task.nodeId]);
                            const isSuccess = task.status === "SUCCEEDED";
                            const isFailed = task.status === "FAILED";
                            const isBlocked = task.status === "BLOCKED";
                            const isSkipped = task.status === "SKIPPED";

                            const statusTheme = {
                              SUCCEEDED: { color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.3)" },
                              FAILED: { color: "#f43f5e", bg: "rgba(244, 63, 94, 0.12)", border: "rgba(244, 63, 94, 0.35)" },
                              BLOCKED: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.3)" },
                              SKIPPED: { color: "#9ca3af", bg: "rgba(156, 163, 175, 0.12)", border: "rgba(156, 163, 175, 0.2)" },
                              CANCELLED: { color: "#c084fc", bg: "rgba(192, 132, 252, 0.12)", border: "rgba(192, 132, 252, 0.3)" },
                              RUNNING: { color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.3)" },
                            };
                            const st = statusTheme[task.status] || { color: "#94a3b8", bg: "rgba(148, 163, 184, 0.12)", border: "var(--border-subtle)" };

                            const isAiNode = task.nodeType?.startsWith("ai.") || task.outputs?.provider === "groq" || task.outputs?.provider === "grok" || Boolean(task.outputs?._aiExecution);
                            const currentTab = taskTabs[task.nodeId] || "outputs";

                            const tabData = currentTab === "inputs"
                              ? (task.inputs || { note: "No direct inputs mapped" })
                              : currentTab === "raw"
                              ? task
                              : (task.outputs || { note: "No outputs emitted" });

                            const handleCopyTaskData = (e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(JSON.stringify(tabData, null, 2));
                              setCopiedTaskId(task.nodeId);
                              setTimeout(() => setCopiedTaskId(null), 2000);
                            };

                            return (
                              <div
                                key={task.nodeId}
                                style={{
                                  background: "var(--bg-card)",
                                  border: `1px solid ${isExpanded ? st.border : "var(--border-subtle)"}`,
                                  borderRadius: "8px",
                                  overflow: "hidden",
                                  transition: "border-color 0.15s ease",
                                }}
                              >
                                {/* Header Row */}
                                <div
                                  onClick={() => toggleNodeExpand(task.nodeId)}
                                  style={{
                                    padding: "9px 12px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    cursor: "pointer",
                                    background: isExpanded ? "rgba(255, 255, 255, 0.02)" : "transparent",
                                  }}
                                >
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                                    {isExpanded ? (
                                      <ChevronDown size={14} color="var(--text-muted)" />
                                    ) : (
                                      <ChevronRight size={14} color="var(--text-muted)" />
                                    )}
                                    <span style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--text-primary)", whiteSpace: "nowrap" }}>
                                      {task.nodeName || task.nodeId}
                                    </span>
                                    <code style={{ fontSize: "0.68rem", color: "var(--brand)", background: "var(--bg-chip)", padding: "1px 6px", borderRadius: "4px" }}>
                                      {task.nodeId}
                                    </code>
                                    <code style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                      ({task.nodeType})
                                    </code>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                                      {task.durationMs !== null ? `${task.durationMs}ms` : "—"}
                                    </span>

                                    {/* AI Node Badge */}
                                    {isAiNode && (
                                      isFailed ? (
                                        <span
                                          style={{
                                            fontSize: "0.68rem",
                                            fontWeight: "700",
                                            color: "#f43f5e",
                                            background: "rgba(244, 63, 94, 0.15)",
                                            border: "1px solid rgba(244, 63, 94, 0.3)",
                                            padding: "1px 6px",
                                            borderRadius: "4px",
                                          }}
                                        >
                                          ⚠️ AI Failed
                                        </span>
                                      ) : (
                                        <span
                                          style={{
                                            fontSize: "0.68rem",
                                            fontWeight: "700",
                                            color: "#38bdf8",
                                            background: "rgba(56, 189, 248, 0.12)",
                                            border: "1px solid rgba(56, 189, 248, 0.3)",
                                            padding: "1px 7px",
                                            borderRadius: "4px",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "3px",
                                          }}
                                        >
                                          <Sparkles size={11} color="#38bdf8" />
                                          Groq AI
                                        </span>
                                      )
                                    )}

                                    {/* Status Badge */}
                                    <span
                                      style={{
                                        fontSize: "0.68rem",
                                        fontWeight: "700",
                                        color: st.color,
                                        background: st.bg,
                                        border: `1px solid ${st.border}`,
                                        padding: "1px 8px",
                                        borderRadius: "4px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "4px",
                                      }}
                                    >
                                      {isSuccess && <CheckCircle2 size={11} />}
                                      {isFailed && <XCircle size={11} />}
                                      {isBlocked && <Ban size={11} />}
                                      {isSkipped && <FastForward size={11} />}
                                      {task.status}
                                    </span>
                                  </div>
                                </div>

                                {/* Expanded Drawer */}
                                {isExpanded && (
                                  <div
                                    style={{
                                      padding: "12px",
                                      borderTop: "1px solid var(--border-subtle)",
                                      background: "rgba(0, 0, 0, 0.2)",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "10px",
                                    }}
                                  >
                                    {/* Groq AI Live Intelligence Callout */}
                                    {isAiNode && isSuccess && (
                                      <div
                                        style={{
                                          background: "rgba(57, 174, 169, 0.08)",
                                          border: "1px solid rgba(57, 174, 169, 0.3)",
                                          borderRadius: "8px",
                                          padding: "10px 12px",
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "8px",
                                        }}
                                      >
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", color: "var(--brand)", fontSize: "0.8rem" }}>
                                            <Sparkles size={14} />
                                            <span>Groq AI Live Execution</span>
                                          </div>
                                          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                                            Model: {task.outputs?.model || "llama-3.3-70b-versatile"}
                                          </span>
                                        </div>

                                        {/* Classification highlights */}
                                        {task.outputs?.category && (
                                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
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
                                              {task.outputs.category}
                                            </span>
                                            {task.outputs?.severity && (
                                              <span
                                                style={{
                                                  fontSize: "0.7rem",
                                                  fontWeight: "700",
                                                  color: task.outputs.severity === "critical" ? "#f43f5e" : task.outputs.severity === "warning" ? "#f59e0b" : "#10b981",
                                                  background: task.outputs.severity === "critical" ? "rgba(244, 63, 94, 0.15)" : task.outputs.severity === "warning" ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                                                  border: `1px solid ${task.outputs.severity === "critical" ? "rgba(244, 63, 94, 0.3)" : task.outputs.severity === "warning" ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                                                  padding: "2px 7px",
                                                  borderRadius: "4px",
                                                  textTransform: "uppercase",
                                                }}
                                              >
                                                {task.outputs.severity}
                                              </span>
                                            )}
                                            {typeof task.outputs?.confidence === "number" && (
                                              <span style={{ fontSize: "0.72rem", color: "#34d399", fontWeight: "600", marginLeft: "auto" }}>
                                                {Math.round(task.outputs.confidence * 100)}% Confidence
                                              </span>
                                            )}
                                          </div>
                                        )}

                                        {task.outputs?.reasoning && (
                                          <div
                                            style={{
                                              fontSize: "0.74rem",
                                              color: "var(--text-secondary)",
                                              background: "rgba(0, 0, 0, 0.25)",
                                              padding: "8px 10px",
                                              borderRadius: "6px",
                                              borderLeft: "3px solid var(--brand)",
                                              lineHeight: 1.4,
                                              fontStyle: "italic",
                                            }}
                                          >
                                            "{task.outputs.reasoning}"
                                          </div>
                                        )}
                                      </div>
                                    )}

                                    {/* Error Container */}
                                    {task.error && (
                                      <div
                                        style={{
                                          padding: "10px",
                                          borderRadius: "6px",
                                          background: "rgba(244, 63, 94, 0.12)",
                                          border: "1px solid rgba(244, 63, 94, 0.3)",
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "4px",
                                        }}
                                      >
                                        <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f43f5e", fontSize: "0.78rem", fontWeight: "700" }}>
                                          <AlertCircle size={14} />
                                          <span>{task.error.code || "TASK_FAILED"}</span>
                                        </div>
                                        <div style={{ fontSize: "0.74rem", color: "#fca5a5", lineHeight: 1.35 }}>
                                          {task.error.message}
                                        </div>
                                      </div>
                                    )}

                                    {/* Tab Navigation & Copy Action */}
                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "6px" }}>
                                      <div style={{ display: "flex", gap: "4px" }}>
                                        {["outputs", "inputs", "raw"].map((tKey) => (
                                          <button
                                            key={tKey}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setTaskTabs((prev) => ({ ...prev, [task.nodeId]: tKey }));
                                            }}
                                            style={{
                                              padding: "3px 8px",
                                              fontSize: "0.72rem",
                                              fontWeight: "600",
                                              textTransform: "capitalize",
                                              background: currentTab === tKey ? "var(--brand)" : "transparent",
                                              color: currentTab === tKey ? "#ffffff" : "var(--text-muted)",
                                              border: "none",
                                              borderRadius: "4px",
                                              cursor: "pointer",
                                              transition: "all 0.15s ease",
                                            }}
                                          >
                                            {tKey}
                                          </button>
                                        ))}
                                      </div>

                                      <button
                                        onClick={handleCopyTaskData}
                                        title="Copy tab content"
                                        style={{
                                          background: "transparent",
                                          border: "none",
                                          color: "var(--text-muted)",
                                          fontSize: "0.72rem",
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "4px",
                                        }}
                                      >
                                        {copiedTaskId === task.nodeId ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                        {copiedTaskId === task.nodeId ? "Copied" : "Copy"}
                                      </button>
                                    </div>

                                    {/* Data Inspector Display */}
                                    <pre
                                      style={{
                                        margin: 0,
                                        padding: "10px",
                                        background: "rgba(0, 0, 0, 0.45)",
                                        border: "1px solid var(--border-subtle)",
                                        borderRadius: "6px",
                                        fontSize: "0.74rem",
                                        fontFamily: "var(--font-mono)",
                                        color: isSuccess ? "#34d399" : isFailed ? "#fca5a5" : "var(--text-secondary)",
                                        overflowX: "auto",
                                        maxHeight: "180px",
                                        lineHeight: 1.35,
                                      }}
                                    >
                                      {JSON.stringify(tabData, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
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
