import React, { useRef, useState } from "react";
import { 
  AlertCircle, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Ban,
  FastForward,
  Slash,
  Sparkles,
  Plus
} from "lucide-react";
import { CATEGORY_META } from "./NodePalette";
import { 
  CARD_WIDTH, 
  HEADER_HEIGHT, 
  PORTS_PADDING_TOP, 
  PORT_ROW_HEIGHT, 
  PORT_ROW_GAP 
} from "./EdgePath";

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
  onQuickConnect,
  errors = [],
  executionTask = null,
  isConnecting = false,
  connectingSourceNodeId = null,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef(null);

  const categoryKey = (metadata && metadata.category) || "general";
  const catMeta = CATEGORY_META[categoryKey] || CATEGORY_META.general;
  const CatIcon = catMeta.icon || Sparkles;

  // Support node errors + cycle detection errors where node is part of the cycle
  const nodeErrors = errors.filter(
    (e) => e.nodeId === node.id || (e.code === "CYCLE_DETECTED" && e.cycle && Array.isArray(e.cycle) && e.cycle.includes(node.id))
  );
  const hasErrors = nodeErrors.length > 0;

  // Ports declaration from node metadata with dynamic switch port support
  const inputs = metadata ? metadata.inputs || {} : {};
  let outputs = metadata ? metadata.outputs || {} : {};

  if (node.type === "logic.switch" && Array.isArray(node.config?.cases)) {
    const dynamicOutputs = {
      default: { type: "any", description: "Default fallback branch" },
      output: { type: "any", description: "Matched case identifier" },
    };
    for (const c of node.config.cases) {
      const portName = typeof c === "object"
        ? (c.port || String(c.case || "").replace(/[^a-zA-Z0-9_]/g, "_"))
        : String(c).replace(/[^a-zA-Z0-9_]/g, "_");
      if (portName) {
        dynamicOutputs[portName] = { type: "any", description: `Case branch: ${portName}` };
      }
    }
    outputs = dynamicOutputs;
  }

  const inputEntries = Object.entries(inputs);
  const outputEntries = Object.entries(outputs);
  const rowCount = Math.max(inputEntries.length, outputEntries.length);

  // Execution status
  const execStatus = executionTask ? executionTask.status : null;

  // Can this node receive connections right now?
  const isEligibleTarget = isConnecting && connectingSourceNodeId !== node.id;

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
        width: `${CARD_WIDTH}px`,
        zIndex: isSelected ? 15 : 10,
        transform: "translate3d(0, 0, 0)",
        opacity: execStatus === "SKIPPED" ? 0.65 : 1,
        transition: "opacity 0.2s ease, box-shadow 0.2s ease",
      }}
      className={`workflow-node ${isSelected ? "selected" : ""} ${hasErrors ? "has-error" : ""}`}
    >
      {/* Category accent bar (4px) */}
      <div 
        style={{
          height: "4px",
          width: "100%",
          background: `linear-gradient(90deg, ${catMeta.color} 0%, rgba(85, 123, 131, 0.4) 100%)`,
          borderTopLeftRadius: "11px",
          borderTopRightRadius: "11px",
        }}
      />

      {/* Node Header (draggable, total height 47px + 4px accent = 51px) */}
      <div
        onMouseDown={(e) => {
          if (e.target.closest("button") || e.target.closest(".port-handle")) return;
          onStartDrag(node.id, e);
        }}
        style={{
          height: "47px",
          boxSizing: "border-box",
          padding: "9px 12px",
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
            <Loader2 size={15} color="var(--brand)" className="animate-spin" />
          )}
          {execStatus === "SUCCEEDED" && (
            <CheckCircle2 size={15} color="#10b981" title={`Succeeded in ${executionTask.durationMs || 0}ms`} />
          )}
          {execStatus === "FAILED" && (
            <XCircle size={15} color="#f43f5e" title={executionTask.error?.message || "Execution Failed"} />
          )}
          {execStatus === "BLOCKED" && (
            <Ban size={14} color="#f59e0b" title="Blocked by upstream failure" />
          )}
          {execStatus === "SKIPPED" && (
            <FastForward size={14} color="#9ca3af" title="Skipped (inactive conditional branch)" />
          )}
          {execStatus === "CANCELLED" && (
            <Slash size={14} color="#c084fc" title="Execution Cancelled" />
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

          {outputEntries.length > 0 && onQuickConnect && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickConnect(node.id, outputEntries[0][0], e);
              }}
              title="Add and connect next node"
              style={{
                background: "var(--brand-light)",
                border: "1px solid var(--brand-border)",
                color: "var(--brand)",
                cursor: "pointer",
                padding: "2px 6px",
                display: "flex",
                alignItems: "center",
                gap: "3px",
                borderRadius: "4px",
                fontSize: "0.68rem",
                fontWeight: "700",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--brand)";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--brand-light)";
                e.currentTarget.style.color = "var(--brand)";
              }}
            >
              <Plus size={11} />
              Next
            </button>
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

      {/* Synchronized Side-by-Side Ports Area (padding top: 8px) */}
      <div 
        style={{ 
          padding: `${PORTS_PADDING_TOP}px 0 10px 0`, 
          display: "flex", 
          flexDirection: "column", 
          gap: `${PORT_ROW_GAP}px` 
        }}
      >
        {rowCount === 0 ? (
          <div style={{ padding: "4px 14px", fontSize: "0.72rem", color: "var(--text-muted)", fontStyle: "italic" }}>
            No ports declared
          </div>
        ) : (
          Array.from({ length: rowCount }).map((_, rowIndex) => {
            const inEntry = inputEntries[rowIndex];
            const outEntry = outputEntries[rowIndex];

            const inPortName = inEntry ? inEntry[0] : null;
            const inPortDef = inEntry ? inEntry[1] : null;
            const inTypeColor = inPortDef ? PORT_TYPE_COLORS[inPortDef.type] || PORT_TYPE_COLORS.any : null;

            const outPortName = outEntry ? outEntry[0] : null;
            const outPortDef = outEntry ? outEntry[1] : null;
            let outTypeColor = outPortDef ? PORT_TYPE_COLORS[outPortDef.type] || PORT_TYPE_COLORS.any : null;

            // Distinctive colors for control-flow branching ports
            if (outPortName === "true") {
              outTypeColor = "#10b981"; // Emerald green for true branch
            } else if (outPortName === "false") {
              outTypeColor = "#f43f5e"; // Rose red for false branch
            } else if (outPortName === "default") {
              outTypeColor = "#a78bfa"; // Soft violet for default branch
            }

            return (
              <div
                key={`port-row-${rowIndex}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  position: "relative",
                  height: `${PORT_ROW_HEIGHT}px`,
                  padding: "0 12px",
                }}
              >
                {/* Left: Input Port */}
                {inPortName ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      position: "relative",
                      cursor: isConnecting ? "pointer" : "default",
                      padding: "2px 4px",
                      borderRadius: "4px",
                      background: isEligibleTarget ? "rgba(57, 174, 169, 0.08)" : "transparent",
                      transition: "all 0.15s ease",
                    }}
                    title={`Input Port: ${inPortName} (${inPortDef.type})`}
                    onClick={(e) => {
                      if (isConnecting) {
                        e.stopPropagation();
                        onCompleteConnection(node.id, inPortName);
                      }
                    }}
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      onCompleteConnection(node.id, inPortName);
                    }}
                  >
                    {/* Input Port Handle (centered in 26px height: top 7px) */}
                    <div
                      id={`port-${node.id}-${inPortName}-input`}
                      className={`port-handle ${isEligibleTarget ? "pulse-target" : ""}`}
                      style={{
                        position: "absolute",
                        left: "-18px", // centered on card left border with -6px relative to card
                        top: "7px",
                        backgroundColor: inTypeColor,
                        color: inTypeColor,
                        boxShadow: isEligibleTarget ? `0 0 10px ${inTypeColor}` : "none",
                      }}
                      title={`Input: ${inPortName} (${inPortDef.type}) - Click to connect`}
                      onClick={(e) => {
                        if (isConnecting) {
                          e.stopPropagation();
                          onCompleteConnection(node.id, inPortName);
                        }
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        onCompleteConnection(node.id, inPortName);
                      }}
                    />
                    <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                      {inPortName}
                    </span>
                    <span 
                      style={{ 
                        fontSize: "0.62rem", 
                        color: inTypeColor, 
                        background: "var(--bg-chip)", 
                        padding: "1px 5px", 
                        borderRadius: "4px",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {inPortDef.type}
                    </span>
                  </div>
                ) : (
                  <div />
                )}

                {/* Right: Output Port */}
                {outPortName ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      position: "relative",
                      cursor: "crosshair",
                      padding: "2px 4px",
                      borderRadius: "4px",
                    }}
                    title={`Output Port: ${outPortName} (${outPortDef.type}) - Click or Drag to connect`}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onStartConnection(node.id, outPortName, e);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartConnection(node.id, outPortName, e);
                    }}
                  >
                    <span 
                      style={{ 
                        fontSize: "0.62rem", 
                        color: outTypeColor, 
                        background: "var(--bg-chip)", 
                        padding: "1px 5px", 
                        borderRadius: "4px",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      {outPortDef.type}
                    </span>
                    <span style={{ fontSize: "0.74rem", color: "var(--text-secondary)", fontWeight: "500" }}>
                      {outPortName}
                    </span>

                    {/* Output Port Handle (centered in 26px height: top 7px) */}
                    <div
                      id={`port-${node.id}-${outPortName}-output`}
                      className="port-handle"
                      style={{
                        position: "absolute",
                        right: "-18px", // centered on card right border with -6px relative to card
                        top: "7px",
                        backgroundColor: outTypeColor,
                        color: outTypeColor,
                      }}
                      title={`Output: ${outPortName} (${outPortDef.type}) - Click or Drag to connect`}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        onStartConnection(node.id, outPortName, e);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartConnection(node.id, outPortName, e);
                      }}
                    />
                  </div>
                ) : (
                  <div />
                )}
              </div>
            );
          })
        )}
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
          borderBottomLeftRadius: "11px",
          borderBottomRightRadius: "11px",
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

