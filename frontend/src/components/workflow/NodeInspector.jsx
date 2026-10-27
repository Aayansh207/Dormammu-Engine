import React, { useState } from "react";
import { 
  X, 
  Trash2, 
  Settings, 
  Layers, 
  Info, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ArrowRight,
  Terminal,
  Sparkles,
  XCircle,
  Ban,
  FastForward,
  Copy,
  Check
} from "lucide-react";
import { CATEGORY_META } from "./NodePalette";

export default function NodeInspector({
  selectedNode,
  metadata,
  onUpdateNode,
  onDeleteNode,
  onClose,
  errors = [],
  executionTask = null,
  readOnly = false,
}) {
  if (!selectedNode) return null;

  const [execTab, setExecTab] = useState("outputs"); // "outputs" | "inputs" | "raw"
  const [copiedExec, setCopiedExec] = useState(false);

  const configSchema = (metadata && metadata.configSchema) || {};
  const currentConfig = selectedNode.config || {};
  const catMeta = CATEGORY_META[metadata?.category] || CATEGORY_META.general;

  // Find errors relating to this node
  const nodeErrors = errors.filter((e) => e.nodeId === selectedNode.id);

  const handleConfigChange = (key, value) => {
    const updated = {
      ...selectedNode,
      config: {
        ...currentConfig,
        [key]: value,
      },
    };
    onUpdateNode(updated);
  };

  const handleNameChange = (e) => {
    onUpdateNode({
      ...selectedNode,
      name: e.target.value,
    });
  };

  return (
    <div
      style={{
        width: "320px",
        minWidth: "320px",
        height: "100%",
        background: "var(--bg-card)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderLeft: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        zIndex: 20,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div 
        style={{
          padding: "16px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Settings size={16} color="var(--primary-light)" />
          <h3 style={{ fontSize: "0.95rem", fontWeight: "700" }}>Node Inspector</h3>
        </div>

        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "4px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Node Identity */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Display Name
          </label>
          <input
            type="text"
            value={selectedNode.name || ""}
            onChange={handleNameChange}
            placeholder="Node display name"
            style={{
              padding: "8px 10px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              color: "var(--text-primary)",
              fontSize: "0.88rem",
              fontWeight: "600",
              outline: "none",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>ID: {selectedNode.id}</span>
            <code style={{ fontSize: "0.72rem", color: catMeta.color, fontFamily: "var(--font-mono)" }}>
              {selectedNode.type}
            </code>
          </div>
        </div>

        {/* Validation Errors on this node */}
        {nodeErrors.length > 0 && (
          <div 
            style={{
              background: "rgba(244, 63, 94, 0.1)",
              border: "1px solid rgba(244, 63, 94, 0.3)",
              borderRadius: "8px",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f43f5e", fontSize: "0.78rem", fontWeight: "700" }}>
              <AlertCircle size={14} />
              <span>Validation Issues</span>
            </div>
            {nodeErrors.map((err, i) => (
              <div key={i} style={{ fontSize: "0.72rem", color: "#fca5a5", lineHeight: 1.4 }}>
                • {err.message}
                {err.field && <span style={{ opacity: 0.8 }}> ({err.field})</span>}
              </div>
            ))}
          </div>
        )}

        {/* Dynamic Configuration Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>
              Configuration
            </span>
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>v{selectedNode.version || 1}</span>
          </div>

          {Object.keys(configSchema).length === 0 ? (
            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.02)", padding: "10px", borderRadius: "6px" }}>
              This node type does not require any fixed configuration settings.
            </div>
          ) : (
            Object.entries(configSchema).map(([key, schema]) => {
              const val = currentConfig[key] !== undefined ? currentConfig[key] : (schema.default !== undefined ? schema.default : "");
              const fieldError = nodeErrors.find((e) => e.field === `config.${key}` || e.field === key);

              return (
                <div key={key} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <label style={{ fontSize: "0.8rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                      {key} {schema.required && <span style={{ color: "#f43f5e" }}>*</span>}
                    </label>
                    <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {schema.type}
                    </span>
                  </div>

                  {/* Input Rendering based on schema.type */}
                  {schema.type === "number" ? (
                    <input
                      type="number"
                      value={val}
                      onChange={(e) => handleConfigChange(key, e.target.value === "" ? "" : Number(e.target.value))}
                      style={{
                        padding: "8px 10px",
                        background: "var(--bg-input)",
                        border: `1px solid ${fieldError ? "#f43f5e" : "var(--border-subtle)"}`,
                        borderRadius: "8px",
                        color: "var(--text-primary)",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    />
                  ) : schema.type === "select" || Array.isArray(schema.enum) ? (
                    <select
                      value={val !== undefined ? val : (schema.default || "")}
                      onChange={(e) => handleConfigChange(key, e.target.value)}
                      style={{
                        padding: "8px 10px",
                        background: "var(--bg-card)",
                        border: `1px solid ${fieldError ? "#f43f5e" : "var(--border-subtle)"}`,
                        borderRadius: "8px",
                        color: "var(--text-primary)",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    >
                      {(schema.options || schema.enum || []).map((opt) => {
                        const optVal = typeof opt === "object" ? opt.value : opt;
                        const optLabel = typeof opt === "object" ? opt.label : opt;
                        return (
                          <option key={optVal} value={optVal}>
                            {optLabel}
                          </option>
                        );
                      })}
                    </select>
                  ) : schema.type === "json" || schema.type === "array" || schema.type === "object" ? (
                    <textarea
                      rows={4}
                      value={typeof val === "object" ? JSON.stringify(val, null, 2) : String(val !== undefined ? val : "")}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          handleConfigChange(key, parsed);
                        } catch {
                          handleConfigChange(key, e.target.value);
                        }
                      }}
                      style={{
                        padding: "8px 10px",
                        background: "var(--bg-input)",
                        border: `1px solid ${fieldError ? "#f43f5e" : "var(--border-subtle)"}`,
                        borderRadius: "8px",
                        color: "var(--text-primary)",
                        fontSize: "0.78rem",
                        fontFamily: "var(--font-mono)",
                        outline: "none",
                        resize: "vertical",
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => handleConfigChange(key, e.target.value)}
                      style={{
                        padding: "8px 10px",
                        background: "var(--bg-input)",
                        border: `1px solid ${fieldError ? "#f43f5e" : "var(--border-subtle)"}`,
                        borderRadius: "8px",
                        color: "var(--text-primary)",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    />
                  )}

                  {schema.description && (
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.3 }}>
                      {schema.description}
                    </span>
                  )}
                  {fieldError && (
                    <span style={{ fontSize: "0.72rem", color: "#f43f5e" }}>
                      {fieldError.message}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Ports summary */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>
            Declared Ports
          </span>

          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "8px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--text-secondary)" }}>Inputs:</span>
            {metadata && Object.keys(metadata.inputs || {}).length > 0 ? (
              Object.entries(metadata.inputs).map(([k, def]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  <span>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>{def.type}</span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>None (Trigger / Entry)</span>
            )}

            <div style={{ height: "1px", background: "var(--border-subtle)", margin: "4px 0" }} />

            <span style={{ fontSize: "0.72rem", fontWeight: "600", color: "var(--text-secondary)" }}>Outputs:</span>
            {metadata && Object.keys(metadata.outputs || {}).length > 0 ? (
              Object.entries(metadata.outputs).map(([k, def]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  <span>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-cyan)" }}>{def.type}</span>
                </div>
              ))
            ) : (
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>None</span>
            )}
          </div>
        </div>

        {/* Comprehensive Node Execution Box */}
        {executionTask && (() => {
          const isSuccess = executionTask.status === "SUCCEEDED";
          const isFailed = executionTask.status === "FAILED";
          const isSkipped = executionTask.status === "SKIPPED";
          const isBlocked = executionTask.status === "BLOCKED";

          const statusColors = {
            SUCCEEDED: { color: "#10b981", bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.3)" },
            FAILED: { color: "#f43f5e", bg: "rgba(244, 63, 94, 0.12)", border: "rgba(244, 63, 94, 0.35)" },
            BLOCKED: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.3)" },
            SKIPPED: { color: "#9ca3af", bg: "rgba(156, 163, 175, 0.12)", border: "rgba(156, 163, 175, 0.25)" },
            CANCELLED: { color: "#c084fc", bg: "rgba(192, 132, 252, 0.12)", border: "rgba(192, 132, 252, 0.3)" },
            RUNNING: { color: "#38bdf8", bg: "rgba(56, 189, 248, 0.12)", border: "rgba(56, 189, 248, 0.3)" },
          };
          const sc = statusColors[executionTask.status] || { color: "#94a3b8", bg: "rgba(148, 163, 184, 0.12)", border: "var(--border-subtle)" };

          const isAiNode = selectedNode.type?.startsWith("ai.") || executionTask.outputs?.provider === "groq" || executionTask.outputs?.provider === "grok" || Boolean(executionTask.outputs?._aiExecution);
          const aiCategory = executionTask.outputs?.category || executionTask.outputs?.output;
          const aiConfidence = typeof executionTask.outputs?.confidence === "number" ? Math.round(executionTask.outputs.confidence * 100) : null;
          const aiReasoning = executionTask.outputs?.reasoning;
          const aiSeverity = executionTask.outputs?.severity;

          const currentTabContent = execTab === "inputs"
            ? (executionTask.inputs || { note: "No direct inputs recorded for this node" })
            : execTab === "raw"
            ? executionTask
            : (executionTask.outputs || { note: "No outputs emitted" });

          const handleCopyCurrent = () => {
            navigator.clipboard.writeText(JSON.stringify(currentTabContent, null, 2));
            setCopiedExec(true);
            setTimeout(() => setCopiedExec(false), 2000);
          };

          return (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                background: "var(--bg-secondary)",
                border: `1px solid ${sc.border}`,
                borderRadius: "10px",
                padding: "12px",
                boxShadow: "0 4px 18px rgba(0, 0, 0, 0.15)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Terminal size={14} color="var(--brand)" />
                  <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-primary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Execution Box
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                    ⚡ {executionTask.durationMs || 0}ms
                  </span>
                  <span
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: "700",
                      color: sc.color,
                      background: sc.bg,
                      border: `1px solid ${sc.border}`,
                      padding: "2px 8px",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {isSuccess && <CheckCircle2 size={11} />}
                    {isFailed && <XCircle size={11} />}
                    {isBlocked && <Ban size={11} />}
                    {isSkipped && <FastForward size={11} />}
                    {executionTask.status}
                  </span>
                </div>
              </div>

              {/* Groq AI Live Intelligence Highlight */}
              {isAiNode && isSuccess && (
                <div
                  style={{
                    background: "rgba(57, 174, 169, 0.08)",
                    border: "1px solid rgba(57, 174, 169, 0.3)",
                    borderRadius: "8px",
                    padding: "10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Sparkles size={13} color="var(--brand)" />
                      <span style={{ fontSize: "0.75rem", fontWeight: "700", color: "var(--brand)" }}>
                        Groq AI Intelligence
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontFamily: "var(--font-mono)",
                        background: "var(--brand-light)",
                        color: "var(--brand)",
                        border: "1px solid var(--brand-border)",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontWeight: "600",
                      }}
                    >
                      {executionTask.outputs?.model || "llama-3.3-70b-versatile"}
                    </span>
                  </div>

                  {aiCategory && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Classified:</span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: "700",
                          color: "var(--text-primary)",
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-subtle)",
                          padding: "2px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        {String(aiCategory)}
                      </span>
                      {aiSeverity && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: "700",
                            color: aiSeverity === "critical" ? "#f43f5e" : aiSeverity === "warning" ? "#f59e0b" : "#10b981",
                            background: aiSeverity === "critical" ? "rgba(244, 63, 94, 0.15)" : aiSeverity === "warning" ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            border: `1px solid ${aiSeverity === "critical" ? "rgba(244, 63, 94, 0.3)" : aiSeverity === "warning" ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            textTransform: "uppercase",
                          }}
                        >
                          {aiSeverity}
                        </span>
                      )}
                      {aiConfidence !== null && (
                        <span style={{ fontSize: "0.7rem", color: "#34d399", fontWeight: "600", marginLeft: "auto" }}>
                          {aiConfidence}% Confidence
                        </span>
                      )}
                    </div>
                  )}

                  {aiReasoning && (
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-secondary)",
                        background: "rgba(0, 0, 0, 0.25)",
                        padding: "8px 10px",
                        borderRadius: "6px",
                        borderLeft: "3px solid var(--brand)",
                        fontStyle: "italic",
                        lineHeight: 1.35,
                      }}
                    >
                      "{aiReasoning}"
                    </div>
                  )}
                </div>
              )}

              {/* Error Alert Box */}
              {executionTask.error && (
                <div
                  style={{
                    background: "rgba(244, 63, 94, 0.12)",
                    border: "1px solid rgba(244, 63, 94, 0.3)",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#f43f5e", fontSize: "0.75rem", fontWeight: "700" }}>
                    <AlertCircle size={14} />
                    <span>{executionTask.error.code || "EXECUTION_ERROR"}</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#fca5a5", lineHeight: 1.3 }}>
                    {executionTask.error.message}
                  </div>
                </div>
              )}

              {/* Tabs & Copy Action */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "6px" }}>
                <div style={{ display: "flex", gap: "4px" }}>
                  {["outputs", "inputs", "raw"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setExecTab(t)}
                      style={{
                        padding: "3px 8px",
                        fontSize: "0.7rem",
                        fontWeight: "600",
                        textTransform: "capitalize",
                        background: execTab === t ? "var(--brand)" : "transparent",
                        color: execTab === t ? "#ffffff" : "var(--text-muted)",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCopyCurrent}
                  title="Copy current tab JSON"
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    fontSize: "0.7rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  {copiedExec ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copiedExec ? "Copied" : "Copy"}
                </button>
              </div>

              {/* JSON Payload Display */}
              <pre
                style={{
                  margin: 0,
                  padding: "10px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  fontSize: "0.72rem",
                  fontFamily: "var(--font-mono)",
                  color: isSuccess ? "#34d399" : isFailed ? "#fca5a5" : "var(--text-secondary)",
                  overflowX: "auto",
                  maxHeight: "180px",
                  lineHeight: 1.35,
                }}
              >
                {JSON.stringify(currentTabContent, null, 2)}
              </pre>
            </div>
          );
        })()}

        {/* Delete Node Button */}
        {!readOnly && (
          <button
            onClick={() => onDeleteNode(selectedNode.id)}
            style={{
              marginTop: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "8px 12px",
              background: "rgba(244, 63, 94, 0.1)",
              border: "1px solid rgba(244, 63, 94, 0.25)",
              borderRadius: "8px",
              color: "#f43f5e",
              fontSize: "0.82rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(244, 63, 94, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(244, 63, 94, 0.1)";
            }}
          >
            <Trash2 size={14} />
            Delete Node
          </button>
        )}
      </div>
    </div>
  );
}
