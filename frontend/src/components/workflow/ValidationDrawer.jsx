import React from "react";
import { X, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function ValidationDrawer({
  isOpen,
  onClose,
  validationResult,
  onSelectElement,
}) {
  if (!isOpen) return null;

  const errors = (validationResult && validationResult.errors) || [];
  const warnings = (validationResult && validationResult.warnings) || [];
  const isValid = errors.length === 0;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "90%",
        maxWidth: "680px",
        background: "var(--bg-card)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${isValid ? "var(--accent-emerald)" : "var(--accent-rose)"}`,
        borderRadius: "14px",
        boxShadow: "var(--shadow-xl)",
        zIndex: 30,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div 
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: isValid ? "rgba(16, 185, 129, 0.08)" : "rgba(244, 63, 94, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {isValid ? (
            <CheckCircle2 size={18} color="#10b981" />
          ) : (
            <AlertCircle size={18} color="#f43f5e" />
          )}
          <span style={{ fontSize: "0.92rem", fontWeight: "700" }}>
            {isValid ? "Workflow is Valid & Ready to Execute" : `Validation Failed (${errors.length} Error${errors.length > 1 ? "s" : ""})`}
          </span>
          {warnings.length > 0 && (
            <span style={{ fontSize: "0.75rem", color: "#f59e0b", background: "rgba(245, 158, 11, 0.15)", padding: "2px 8px", borderRadius: "10px" }}>
              {warnings.length} Warning{warnings.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {isValid && warnings.length === 0 && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#10b981", fontSize: "0.88rem" }}>
            🎉 All node connections, configuration contracts, and DAG constraints verified successfully!
          </div>
        )}

        {errors.map((err, idx) => (
          <div
            key={`err-${idx}`}
            onClick={() => {
              if (err.nodeId) onSelectElement(err.nodeId, "node");
              else if (err.edgeId) onSelectElement(err.edgeId, "edge");
              else if (err.cycle && err.cycle.length > 0) onSelectElement(err.cycle[0], "node");
            }}
            style={{
              padding: "10px 12px",
              background: "rgba(244, 63, 94, 0.08)",
              border: "1px solid rgba(244, 63, 94, 0.2)",
              borderRadius: "8px",
              cursor: (err.nodeId || err.edgeId || (err.cycle && err.cycle.length > 0)) ? "pointer" : "default",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
              transition: "transform 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (err.nodeId || err.edgeId || err.cycle) e.currentTarget.style.transform = "translateX(4px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateX(0px)";
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <AlertCircle size={15} color="#f43f5e" style={{ marginTop: "2px", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "0.84rem", color: "#fecdd3", fontWeight: "600" }}>
                  {err.message}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <code>{err.code}</code>
                  {err.field && <span>Field: {err.field}</span>}
                  {err.cycle && Array.isArray(err.cycle) && (
                    <span style={{ color: "#fca5a5" }}>
                      Cycle: {err.cycle.join(" → ")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {(err.nodeId || err.edgeId || (err.cycle && err.cycle.length > 0)) && (
              <span style={{ fontSize: "0.7rem", color: "#f43f5e", background: "rgba(244,63,94,0.15)", padding: "2px 8px", borderRadius: "4px", whiteSpace: "nowrap" }}>
                Target: {err.nodeId || err.edgeId || err.cycle[0]}
              </span>
            )}
          </div>
        ))}

        {warnings.map((warn, idx) => (
          <div
            key={`warn-${idx}`}
            onClick={() => {
              if (warn.nodeId) onSelectElement(warn.nodeId, "node");
            }}
            style={{
              padding: "10px 12px",
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.2)",
              borderRadius: "8px",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "12px",
              cursor: warn.nodeId ? "pointer" : "default",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <AlertTriangle size={15} color="#f59e0b" style={{ marginTop: "2px", flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: "0.84rem", color: "#fef3c7" }}>
                  {warn.message}
                </div>
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  <code>{warn.code}</code>
                </div>
              </div>
            </div>

            {warn.nodeId && (
              <span style={{ fontSize: "0.7rem", color: "#f59e0b", background: "rgba(245,158,11,0.15)", padding: "2px 8px", borderRadius: "4px" }}>
                Node: {warn.nodeId}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
