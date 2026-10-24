import React, { useRef, useState } from "react";
import { 
  AlertCircle, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Clock,
  Sparkles
} from "lucide-react";
import { CATEGORY_META } from "./NodePalette";

const PORT_TYPE_COLORS = {
  number: "#39AEA9",
  string: "#A2D5AB",
  boolean: "#E5EFC1",
  object: "#557B83",
  array: "#39AEA9",
  any: "#9ab3b5",
};

export default function NodeCard({
  node,
  metadata,
  isSelected,
  onSelect,
  onDelete,
  onStartDrag,
  onStartConnection,
  onCompleteConnection,
  errors = [],
  executionTask = null,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef(null);

  const categoryKey = (metadata && metadata.category) || "general";
  const catMeta = CATEGORY_META[categoryKey] || CATEGORY_META.general;
  const CatIcon = catMeta.icon || Sparkles;

  const nodeErrors = errors.filter((e) => e.nodeId === node.id);
  const hasErrors = nodeErrors.length > 0;

  // Ports declaration from node metadata
  const inputs = metadata ? metadata.inputs || {} : {};
  const outputs = metadata ? metadata.outputs || {} : {};

  // Execution status
  const execStatus = executionTask ? executionTask.status : null;

  return (
    <div
      ref={cardRef}
      id={`node-${node.id}`}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.id);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "absolute",
        left: `${node.position.x}px`,
        top: `${node.position.y}px`,
        width: "240px",
        zIndex: isSelected ? 15 : 10,
        transform: "translate3d(0, 0, 0)",
      }}
      className={`workflow-node ${isSelected ? "selected" : ""} ${hasErrors ? "has-error" : ""}`}
    >
      {/* Category accent bar */}
      <div 
        style={{
          height: "4px",
          width: "100%",
          background: `linear-gradient(90deg, ${catMeta.color} 0%, rgba(85, 123, 131, 0.4) 100%)`,
          borderTopLeftRadius: "11px",
          borderTopRightRadius: "11px",
        }}
      />

      {/* Node Header (draggable) */}
      <div
        onMouseDown={(e) => {
          if (e.target.closest("button") || e.target.closest(".port-handle")) return;
          onStartDrag(node.id, e);
        }}
        style={{
          padding: "10px 12px 8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "grab",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
          <div 
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "5px",
              background: catMeta.glow,
              color: catMeta.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <CatIcon size={13} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <span 
              title={node.name}
              style={{
                fontSize: "0.85rem",
                fontWeight: "700",
                color: "var(--text-primary)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                lineHeight: 1.2,
              }}
            >
              {node.name || node.id}
            </span>
            <code style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
              {node.type}
            </code>
          </div>
        </div>

        {/* Action icons / status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          {execStatus === "RUNNING" && (
            <Loader2 size={15} color="var(--primary-light)" className="animate-spin" />
          )}
          {execStatus === "SUCCEEDED" && (
            <CheckCircle2 size={15} color="#10b981" title={`Succeeded in ${executionTask.durationMs || 0}ms`} />
          )}
          {execStatus === "FAILED" && (
            <XCircle size={15} color="#f43f5e" title={executionTask.error?.message || "Execution Failed"} />
          )}

          {hasErrors && (
            <div 
              className="badge-error-pulse"
              title={nodeErrors.map((e) => e.message).join("\n")}
              style={{
                width: "18px",
                height: "18px",
                borderRadius: "50%",
                background: "rgba(244, 63, 94, 0.2)",
                color: "#f43f5e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <AlertCircle size={13} />
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            title="Delete Node"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
              alignItems: "center",
              borderRadius: "4px",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f43f5e")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Ports Area */}
      <div style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: "6px" }}>
        {/* Input and Output ports list */}
        {Object.entries(inputs).map(([portName, portDef]) => {
          const typeColor = PORT_TYPE_COLORS[portDef.type] || PORT_TYPE_COLORS.any;
          return (
            <div 
              key={`in-${portName}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                position: "relative",
                paddingLeft: "14px",
                height: "22px",
              }}
            >
              {/* Input Port Handle (Left edge) */}
              <div
                id={`port-${node.id}-${portName}-input`}
                className="port-handle"
                style={{
                  position: "absolute",
                  left: "-6px",
                  top: "5px",
                  backgroundColor: typeColor,
                  color: typeColor,
                }}
                title={`Input Port: ${portName} (${portDef.type})`}
                onMouseUp={(e) => {
                  e.stopPropagation();
                  onCompleteConnection(node.id, portName);
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                  {portName}
                </span>
                <span style={{ fontSize: "0.62rem", color: typeColor, background: "var(--bg-chip)", padding: "1px 5px", borderRadius: "4px" }}>
                  {portDef.type}
                </span>
              </div>
            </div>
          );
        })}

        {Object.entries(outputs).map(([portName, portDef]) => {
          const typeColor = PORT_TYPE_COLORS[portDef.type] || PORT_TYPE_COLORS.any;
          return (
            <div 
              key={`out-${portName}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                position: "relative",
                paddingRight: "14px",
                height: "22px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.62rem", color: typeColor, background: "var(--bg-chip)", padding: "1px 5px", borderRadius: "4px" }}>
                  {portDef.type}
                </span>
                <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                  {portName}
                </span>
              </div>

              {/* Output Port Handle (Right edge) */}
              <div
                id={`port-${node.id}-${portName}-output`}
                className="port-handle"
                style={{
                  position: "absolute",
                  right: "-6px",
                  top: "5px",
                  backgroundColor: typeColor,
                  color: typeColor,
                }}
                title={`Output Port: ${portName} (${portDef.type}) - Drag to connect`}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  onStartConnection(node.id, portName, e);
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Config preview bar if configured */}
      {node.config && Object.keys(node.config).length > 0 && (
        <div style={{
          padding: "6px 12px 8px 12px",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
          fontSize: "0.68rem",
          color: "var(--text-muted)",
          display: "flex",
          gap: "8px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}>
          {Object.entries(node.config).map(([k, v]) => (
            <span key={k}>
              <strong style={{ color: "var(--text-secondary)" }}>{k}:</strong> {typeof v === "object" ? "{...}" : String(v)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
