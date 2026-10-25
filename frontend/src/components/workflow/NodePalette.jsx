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
  Play,
  GitFork,
  Clock,
  Layers,
  Globe,
  Bot
} from "lucide-react";

export const CATEGORY_META = {
  trigger: {
    label: "Triggers & Input",
    color: "#39AEA9",
    glow: "rgba(57, 174, 169, 0.35)",
    icon: Play,
  },
  logic: {
    label: "Logic & Branching",
    color: "#E5A93B",
    glow: "rgba(229, 169, 59, 0.35)",
    icon: GitFork,
  },
  flow: {
    label: "Flow Control",
    color: "#9D65C9",
    glow: "rgba(157, 101, 201, 0.35)",
    icon: Clock,
  },
  data: {
    label: "Data Transformation",
    color: "#38B2AC",
    glow: "rgba(56, 178, 172, 0.35)",
    icon: Layers,
  },
  http: {
    label: "HTTP & Webhooks",
    color: "#3182CE",
    glow: "rgba(49, 130, 206, 0.35)",
    icon: Globe,
  },
  ai: {
    label: "AI & Intelligence",
    color: "#EC4899",
    glow: "rgba(236, 72, 153, 0.35)",
    icon: Bot,
  },
  mathematical: {
    label: "Mathematical",
    color: "#557B83",
    glow: "rgba(85, 123, 131, 0.35)",
    icon: Calculator,
  },
  math: {
    label: "Mathematical",
    color: "#557B83",
    glow: "rgba(85, 123, 131, 0.35)",
    icon: Calculator,
  },
  json: {
    label: "JSON & Data",
    color: "#39AEA9",
    glow: "rgba(57, 174, 169, 0.35)",
    icon: FileJson,
  },
  text: {
    label: "Text & Templates",
    color: "#A2D5AB",
    glow: "rgba(162, 213, 171, 0.35)",
    icon: Type,
  },
  utility: {
    label: "Utilities",
    color: "#557B83",
    glow: "rgba(85, 123, 131, 0.35)",
    icon: Sparkles,
  },
  output: {
    label: "Output & Log",
    color: "#A2D5AB",
    glow: "rgba(162, 213, 171, 0.35)",
    icon: Terminal,
  },
  general: {
    label: "General",
    color: "#557B83",
    glow: "rgba(85, 123, 131, 0.35)",
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
  const categories = ["all", "trigger", "logic", "flow", "data", "ai", "http", "mathematical", "text", "json", "utility", "output"];

  return (
    <div 
      style={{
        width: isOpen ? "300px" : "0px",
        minWidth: isOpen ? "300px" : "0px",
        height: "100%",
        background: "var(--bg-card)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
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
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--brand)" }} />
            <h3 style={{ fontSize: "0.95rem", fontWeight: "700", letterSpacing: "-0.01em", color: "var(--text-primary)" }}>
              Node Catalogue
            </h3>
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", background: "var(--bg-chip)", padding: "2px 8px", borderRadius: "10px" }}>
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
            className="input-control"
            style={{
              padding: "7px 28px 7px 32px",
              fontSize: "0.82rem",
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: "2px",
                fontSize: "0.75rem",
              }}
            >
              ✕
            </button>
          )}
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
                  background: isSelected ? "var(--brand)" : "var(--bg-chip)",
                  color: isSelected ? "#ffffff" : "var(--text-secondary)",
                  border: isSelected ? "1px solid var(--brand)" : "1px solid var(--border-subtle)",
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
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/dormammu-node", JSON.stringify(node));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onAddNode(node)}
                style={{
                  background: "var(--bg-secondary)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  cursor: "grab",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                  position: "relative",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = meta.color;
                  e.currentTarget.style.transform = "translateX(4px)";
                  e.currentTarget.style.background = "var(--bg-chip-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-subtle)";
                  e.currentTarget.style.transform = "translateX(0px)";
                  e.currentTarget.style.background = "var(--bg-secondary)";
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
