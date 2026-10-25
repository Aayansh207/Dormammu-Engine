import React, { useState, useEffect, useRef } from "react";
import { 
  Search, 
  X, 
  Sparkles, 
  ArrowRight, 
  Calculator, 
  FileJson, 
  Type, 
  Terminal, 
  Play, 
  HelpCircle,
  Zap
} from "lucide-react";
import { CATEGORY_META } from "./NodePalette";

const POPULAR_NODE_TYPES = [
  "math.multiply",
  "math.add",
  "json.parse",
  "json.get",
  "text.concat",
  "output.return",
  "output.log",
  "utility.uuid",
  "utility.datetime"
];

export default function QuickAddPopover({
  isOpen,
  onClose,
  position, // { screenX, screenY, canvasX, canvasY }
  catalogue = [],
  autoConnectSource = null, // { nodeId, portName, portType }
  onSelectNode,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm("");
      setSelectedIndex(0);
      // Auto focus input after render
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Filter catalogue
  let displayNodes = catalogue.filter((node) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      node.label.toLowerCase().includes(term) ||
      node.type.toLowerCase().includes(term) ||
      (node.description && node.description.toLowerCase().includes(term)) ||
      (node.category && node.category.toLowerCase().includes(term))
    );
  });

  // If there is an autoConnectSource and no search, prioritize nodes with compatible inputs
  if (autoConnectSource && !searchTerm.trim()) {
    displayNodes = [...displayNodes].sort((a, b) => {
      const aInputs = Object.keys(a.inputs || {}).length;
      const bInputs = Object.keys(b.inputs || {}).length;
      // Nodes with inputs come first
      if (aInputs > 0 && bInputs === 0) return -1;
      if (bInputs > 0 && aInputs === 0) return 1;
      return 0;
    });
  } else if (!searchTerm.trim()) {
    // Sort popular nodes first
    displayNodes = [...displayNodes].sort((a, b) => {
      const aPop = POPULAR_NODE_TYPES.indexOf(a.type);
      const bPop = POPULAR_NODE_TYPES.indexOf(b.type);
      if (aPop !== -1 && bPop === -1) return -1;
      if (bPop !== -1 && aPop === -1) return 1;
      if (aPop !== -1 && bPop !== -1) return aPop - bPop;
      return 0;
    });
  }

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < displayNodes.length ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (displayNodes[selectedIndex]) {
        handlePick(displayNodes[selectedIndex]);
      }
    }
  };

  const handlePick = (nodeMeta) => {
    onSelectNode(nodeMeta, { x: position.canvasX, y: position.canvasY }, autoConnectSource);
    onClose();
  };

  // Keep popover inside screen bounds
  const popoverWidth = 320;
  const popoverHeight = 380;
  const screenW = window.innerWidth;
  const screenH = window.innerHeight;

  let left = position.screenX ? position.screenX - 20 : screenW / 2 - popoverWidth / 2;
  let top = position.screenY ? position.screenY - 20 : screenH / 2 - popoverHeight / 2;

  if (left + popoverWidth > screenW - 20) {
    left = screenW - popoverWidth - 20;
  }
  if (left < 20) left = 20;

  if (top + popoverHeight > screenH - 20) {
    top = screenH - popoverHeight - 20;
  }
  if (top < 65) top = 65;

  return (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        width: `${popoverWidth}px`,
        maxHeight: `${popoverHeight}px`,
        zIndex: 100,
        background: "var(--bg-card)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid var(--border-medium)",
        borderRadius: "var(--radius-md)",
        boxShadow: "0 18px 45px rgba(0, 0, 0, 0.4)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        animation: "fadeInScale 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Popover Header */}
      <div
        style={{
          padding: "10px 12px",
          borderBottom: "1px solid var(--border-subtle)",
          background: autoConnectSource ? "var(--brand-light)" : "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Zap size={14} color="var(--brand)" />
          <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-primary)" }}>
            {autoConnectSource ? (
              <span>
                Connect from <code style={{ color: "var(--brand)" }}>{autoConnectSource.nodeId}</code>
              </span>
            ) : (
              "Add Node"
            )}
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "2px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Search Input Box */}
      <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-subtle)", position: "relative" }}>
        <Search
          size={14}
          style={{ position: "absolute", left: "18px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search node (e.g. math, json, return)..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "6px 10px 6px 30px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "6px",
            color: "var(--text-primary)",
            fontSize: "0.82rem",
            outline: "none",
          }}
        />
      </div>

      {/* Nodes List */}
      <div
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: "auto",
          maxHeight: "260px",
          padding: "6px",
          display: "flex",
          flexDirection: "column",
          gap: "3px",
        }}
      >
        {displayNodes.length === 0 ? (
          <div style={{ padding: "20px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.78rem" }}>
            No matching nodes found
          </div>
        ) : (
          displayNodes.map((item, idx) => {
            const isHighlighted = idx === selectedIndex;
            const catMeta = CATEGORY_META[item.category] || CATEGORY_META.general;
            const CatIcon = catMeta.icon || Sparkles;

            const inputsCount = Object.keys(item.inputs || {}).length;
            const outputsCount = Object.keys(item.outputs || {}).length;

            return (
              <div
                key={item.type}
                onClick={() => handlePick(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background: isHighlighted ? "var(--bg-card-hover)" : "transparent",
                  border: isHighlighted ? "1px solid var(--border-medium)" : "1px solid transparent",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "8px",
                  transition: "background 0.1s ease",
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
                    <CatIcon size={12} />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "0.82rem",
                          fontWeight: "600",
                          color: "var(--text-primary)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.label || item.type}
                      </span>
                    </div>
                    {item.description && (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--text-muted)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: "180px",
                        }}
                      >
                        {item.description}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: "0.62rem",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      background: "var(--bg-chip)",
                      color: "var(--text-secondary)",
                    }}
                  >
                    in:{inputsCount} out:{outputsCount}
                  </span>
                  {isHighlighted && <ArrowRight size={12} color="var(--brand)" />}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer shortcut helper */}
      <div
        style={{
          padding: "6px 12px",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.65rem",
          color: "var(--text-muted)",
        }}
      >
        <span>↑↓ Navigate</span>
        <span>↵ Select</span>
        <span>Esc Close</span>
      </div>
    </div>
  );
}
