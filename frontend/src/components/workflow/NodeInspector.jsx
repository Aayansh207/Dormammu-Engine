import React from "react";
import { 
  X, 
  Trash2, 
  Settings, 
  Layers, 
  Info, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ArrowRight
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
}) {
  if (!selectedNode) return null;

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
        background: "rgba(10, 13, 22, 0.95)",
        backdropFilter: "blur(20px)",
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
                        background: "rgba(255, 255, 255, 0.05)",
                        border: `1px solid ${fieldError ? "#f43f5e" : "var(--border-subtle)"}`,
                        borderRadius: "8px",
                        color: "var(--text-primary)",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    />
                  ) : schema.type === "select" ? (
                    <select
                      value={val}
                      onChange={(e) => handleConfigChange(key, e.target.value)}
                      style={{
                        padding: "8px 10px",
                        background: "#0f1420",
                        border: `1px solid ${fieldError ? "#f43f5e" : "var(--border-subtle)"}`,
                        borderRadius: "8px",
                        color: "var(--text-primary)",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                    >
                      {(schema.options || []).map((opt) => {
                        const optVal = typeof opt === "object" ? opt.value : opt;
                        const optLabel = typeof opt === "object" ? opt.label : opt;
                        return (
                          <option key={optVal} value={optVal}>
                            {optLabel}
                          </option>
                        );
                      })}
                    </select>
                  ) : schema.type === "json" ? (
                    <textarea
                      rows={3}
                      value={typeof val === "object" ? JSON.stringify(val, null, 2) : String(val)}
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
                        background: "rgba(255, 255, 255, 0.05)",
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
                        background: "rgba(255, 255, 255, 0.05)",
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

        {/* Execution Output Preview if node was run */}
        {executionTask && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Execution Results
              </span>
              <span style={{
                fontSize: "0.68rem",
                fontWeight: "700",
                color: executionTask.status === "SUCCEEDED" ? "#10b981" : "#f43f5e",
                background: executionTask.status === "SUCCEEDED" ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                padding: "2px 6px",
                borderRadius: "4px",
              }}>
                {executionTask.status}
              </span>
            </div>

            <div style={{ background: "rgba(0, 0, 0, 0.3)", border: "1px solid var(--border-subtle)", borderRadius: "8px", padding: "10px", fontSize: "0.72rem", fontFamily: "var(--font-mono)", color: "var(--text-secondary)", overflowX: "auto" }}>
              <div>Duration: {executionTask.durationMs || 0}ms</div>
              <div style={{ marginTop: "6px", fontWeight: "600", color: "var(--text-primary)" }}>Output:</div>
              <pre style={{ margin: "4px 0 0 0", color: "var(--accent-emerald)" }}>
                {JSON.stringify(executionTask.outputs, null, 2) || "null"}
              </pre>
              {executionTask.error && (
                <div style={{ marginTop: "6px", color: "#f43f5e" }}>
                  Error: {executionTask.error.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Delete Node Button */}
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
      </div>
    </div>
  );
}
