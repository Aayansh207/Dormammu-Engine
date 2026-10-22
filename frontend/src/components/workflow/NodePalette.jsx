import React, { useState } from "react";
import { 
  Search, 
  Plus, 
  Sparkles, 
  Calculator, 
  FileJson, 
  Type, 
  Terminal, 
  ArrowRightCircle, 
  HelpCircle,
  Play
} from "lucide-react";

export const CATEGORY_META = {
  trigger: {
    label: "Triggers & Input",
    color: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.35)",
    icon: Play,
  },
  mathematical: {
    label: "Mathematical",
    color: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.35)",
    icon: Calculator,
  },
  math: {
    label: "Mathematical",
    color: "#06b6d4",
    glow: "rgba(6, 182, 212, 0.35)",
    icon: Calculator,
  },
  json: {
    label: "JSON & Data",
    color: "#8b5cf6",
    glow: "rgba(139, 92, 246, 0.35)",
    icon: FileJson,
  },
  text: {
    label: "Text & Utilities",
    color: "#10b981",
    glow: "rgba(16, 185, 129, 0.35)",
    icon: Type,
  },
  utility: {
    label: "Utilities",
    color: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.35)",
    icon: Sparkles,
  },
  output: {
    label: "Output & Log",
    color: "#ec4899",
    glow: "rgba(236, 72, 153, 0.35)",
    icon: Terminal,
  },
  general: {
    label: "General",
    color: "#64748b",
    glow: "rgba(100, 116, 139, 0.35)",
    icon: HelpCircle,
  },
};

export default function NodePalette({ catalogue = [], onAddNode, isOpen, onToggle }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredNodes = catalogue.filter((node) => {
    const matchesSearch = 
      node.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      node.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (node.description && node.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const categoryKey = node.category || "general";
    const matchesCategory = 
      selectedCategory === "all" || 
      categoryKey === selectedCategory || 
      (selectedCategory === "mathematical" && categoryKey === "math");

    return matchesSearch && matchesCategory;
  });

  // Group nodes by category
  const categories = ["all", "trigger", "mathematical", "json", "text", "utility", "output"];

  return (
    <div 
      style={{
        width: isOpen ? "300px" : "0px",
        minWidth: isOpen ? "300px" : "0px",
        height: "100%",
        background: "rgba(10, 13, 22, 0.95)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.25s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        overflow: "hidden",
        zIndex: 20,
        position: "relative",
      }}
    >
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--primary-light)" }} />
            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", letterSpacing: "-0.01em" }}>
              Node Catalogue
            </h3>
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "10px" }}>
            {catalogue.length} Available
          </span>
        </div>

        {/* Search Bar */}
        <div style={{ position: "relative" }}>
          <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input 
            type="text"
            placeholder="Search nodes (e.g. multiply, json)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 10px 8px 32px",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              color: "var(--text-primary)",
              fontSize: "0.82rem",
              outline: "none",
            }}
          />
        </div>

        {/* Category Pills */}
        <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "2px" }} className="custom-scrollbar">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            const meta = CATEGORY_META[cat];
            const label = cat === "all" ? "All" : (meta ? meta.label.split(" ")[0] : cat);
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: "4px 10px",
                  borderRadius: "20px",
                  fontSize: "0.72rem",
                  fontWeight: isSelected ? "600" : "500",
                  whiteSpace: "nowrap",
                  background: isSelected ? "var(--primary)" : "rgba(255, 255, 255, 0.05)",
                  color: isSelected ? "#ffffff" : "var(--text-secondary)",
                  border: isSelected ? "1px solid var(--primary-light)" : "1px solid var(--border-subtle)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Nodes List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {filteredNodes.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)", fontSize: "0.82rem" }}>
            No nodes found matching "{searchTerm}"
          </div>
        ) : (
          filteredNodes.map((node) => {
            const meta = CATEGORY_META[node.category] || CATEGORY_META.general;
            const IconComponent = meta.icon || Sparkles;

            return (
              <div
                key={node.type}
                onClick={() => onAddNode(node)}
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = meta.color;
                  e.currentTarget.style.transform = "translateX(4px)";
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.transform = "translateX(0px)";
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div 
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "6px",
                        background: meta.glow,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: meta.color,
                      }}
                    >
                      <IconComponent size={14} />
                    </div>
                    <span style={{ fontSize: "0.86rem", fontWeight: "600", color: "var(--text-primary)" }}>
                      {node.label}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddNode(node);
                    }}
                    title="Add to canvas"
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "none",
                      color: "var(--text-secondary)",
                      borderRadius: "6px",
                      width: "24px",
                      height: "24px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                  {node.description}
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2px" }}>
                  <code style={{ fontSize: "0.68rem", color: meta.color, fontFamily: "var(--font-mono)" }}>
                    {node.type}
                  </code>

                  <div style={{ display: "flex", gap: "6px", fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    <span>{Object.keys(node.inputs || {}).length} in</span>
                    <span>•</span>
                    <span>{Object.keys(node.outputs || {}).length} out</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
