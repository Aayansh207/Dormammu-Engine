import React, { useState } from "react";
import { X } from "lucide-react";

export function calculatePortPosition(node, portName, portType, metadata) {
  if (!node || !node.position) return { x: 0, y: 0 };

  const CARD_WIDTH = 240;
  const HEADER_HEIGHT = 42;
  const PORT_HEIGHT = 22;

  if (portType === "output") {
    const outputs = metadata ? Object.keys(metadata.outputs || {}) : [];
    const index = outputs.indexOf(portName);
    const validIndex = index >= 0 ? index : 0;
    return {
      x: node.position.x + CARD_WIDTH,
      y: node.position.y + HEADER_HEIGHT + validIndex * PORT_HEIGHT + 11,
    };
  } else {
    const inputs = metadata ? Object.keys(metadata.inputs || {}) : [];
    const index = inputs.indexOf(portName);
    const validIndex = index >= 0 ? index : 0;
    return {
      x: node.position.x,
      y: node.position.y + HEADER_HEIGHT + validIndex * PORT_HEIGHT + 11,
    };
  }
}

export function generateBezierPath(x1, y1, x2, y2) {
  const dx = Math.abs(x2 - x1) * 0.5;
  const controlDistance = Math.max(dx, 50);
  return `M ${x1} ${y1} C ${x1 + controlDistance} ${y1}, ${x2 - controlDistance} ${y2}, ${x2} ${y2}`;
}

export default function EdgePath({
  edge,
  sourceNode,
  targetNode,
  sourceMetadata,
  targetMetadata,
  isSelected,
  onSelect,
  onDelete,
  hasError = false,
  isRunning = false,
}) {
  const [isHovered, setIsHovered] = useState(false);

  if (!sourceNode || !targetNode) return null;

  const start = calculatePortPosition(sourceNode, edge.sourcePort, "output", sourceMetadata);
  const end = calculatePortPosition(targetNode, edge.targetPort, "input", targetMetadata);
  const pathData = generateBezierPath(start.x, start.y, end.x, end.y);

  // Center point for delete button
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;

  let strokeColor = "var(--wire-default)";
  if (hasError) strokeColor = "var(--accent-rose)";
  else if (isSelected) strokeColor = "var(--brand)";
  else if (isHovered) strokeColor = "var(--brand-hover)";

  return (
    <g 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: "pointer" }}
    >
      {/* Invisible thick stroke for easy mouse hit area */}
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(edge.id);
        }}
      />

      {/* Visible Bezier Curve */}
      <path
        d={pathData}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isSelected || isHovered ? "3" : "2"}
        className={`connection-curve ${isRunning ? "running-edge-dash" : ""}`}
        style={{
          filter: isSelected || isHovered ? `drop-shadow(0 0 6px ${strokeColor})` : "none",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(edge.id);
        }}
      />

      {/* Delete button on hover or selection */}
      {(isHovered || isSelected) && (
        <g 
          transform={`translate(${midX - 10}, ${midY - 10})`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(edge.id);
          }}
          style={{ cursor: "pointer" }}
        >
          <circle 
            r="10" 
            cx="10" 
            cy="10" 
            fill="#f43f5e" 
            stroke="var(--bg-main)" 
            strokeWidth="2" 
          />
          <line x1="7" y1="7" x2="13" y2="13" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="13" y1="7" x2="7" y2="13" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}
