import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Workflow, 
  Play, 
  Trash2, 
  ExternalLink, 
  Clock, 
  Layers, 
  GitBranch, 
  Search,
  Sparkles,
  Loader2,
  Calculator,
  FileJson
} from "lucide-react";
import { api } from "../../services/api";

const STARTER_TEMPLATES = [
  {
    id: "canonical_math",
    name: "Canonical Math Multiply",
    description: "Standard 3-node multiply chain from Webster specification (Trigger -> Math Multiply -> Return)",
    icon: Calculator,
    color: "#06b6d4",
    definition: {
      schemaVersion: 1,
      name: "Canonical Math Multiply",
      nodes: [
        {
          id: "trigger_01",
          type: "trigger.manual",
          version: 1,
          name: "Manual Trigger",
          position: { x: 120, y: 180 },
          config: {},
        },
        {
          id: "math_01",
          type: "math.multiply",
          version: 1,
          name: "Multiply by 5",
          position: { x: 420, y: 180 },
          config: { factor: 5 },
        },
        {
          id: "output_01",
          type: "output.return",
          version: 1,
          name: "Return Result",
          position: { x: 720, y: 180 },
          config: {},
        },
      ],
      edges: [
        {
          id: "edge_01",
          source: "trigger_01",
          sourcePort: "output",
          target: "math_01",
          targetPort: "input",
        },
        {
          id: "edge_02",
          source: "math_01",
          sourcePort: "output",
          target: "output_01",
          targetPort: "input",
        },
      ],
    },
  },
  {
    id: "json_pipeline",
    name: "JSON Data Extractor",
    description: "Parse incoming JSON string and extract nested property",
    icon: FileJson,
    color: "#8b5cf6",
    definition: {
      schemaVersion: 1,
      name: "JSON Data Extractor",
      nodes: [
        {
          id: "trigger_01",
          type: "trigger.manual",
          version: 1,
          name: "Manual Trigger",
          position: { x: 120, y: 180 },
          config: { defaultPayload: '{"user": {"name": "Alice", "score": 98}}' },
        },
        {
          id: "parse_01",
          type: "json.parse",
          version: 1,
          name: "Parse JSON",
          position: { x: 400, y: 180 },
          config: {},
        },
        {
          id: "get_01",
          type: "json.get",
          version: 1,
          name: "Get user.name",
          position: { x: 680, y: 180 },
          config: { path: "user.name" },
        },
        {
          id: "output_01",
          type: "output.return",
          version: 1,
          name: "Return Name",
          position: { x: 960, y: 180 },
          config: {},
        },
      ],
      edges: [
        {
          id: "edge_01",
          source: "trigger_01",
          sourcePort: "output",
          target: "parse_01",
          targetPort: "input",
        },
        {
          id: "edge_02",
          source: "parse_01",
          sourcePort: "output",
          target: "get_01",
          targetPort: "input",
        },
        {
          id: "edge_03",
          source: "get_01",
          sourcePort: "output",
          target: "output_01",
          targetPort: "input",
        },
      ],
    },
  },
  {
    id: "blank",
    name: "Blank Canvas",
    description: "Start from a clean canvas with no pre-configured nodes",
    icon: Workflow,
    color: "#7c3aed",
    definition: {
      schemaVersion: 1,
      name: "Untitled Workflow",
      nodes: [],
      edges: [],
    },
  },
];

export default function WorkflowList({ onOpenWorkflow, user, onOpenAuth }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, [user]);

  const loadWorkflows = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.listWorkflows();
      if (res && res.data) {
        setWorkflows(res.data);
      }
    } catch (err) {
      console.error("Failed to load workflows:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFromTemplate = async (template) => {
    setIsCreating(true);
    try {
      const res = await api.createWorkflow({
        name: template.name,
        description: template.description,
        definition: template.definition,
      });

      if (res && res.data) {
        setIsTemplateModalOpen(false);
        onOpenWorkflow(res.data.id);
      }
    } catch (err) {
      console.error("Failed to create workflow:", err);
      alert(`Failed to create workflow: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this workflow and all saved versions?")) return;

    try {
      await api.deleteWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch (err) {
      console.error("Failed to delete workflow:", err);
      alert(`Delete failed: ${err.message}`);
    }
  };

  const filteredWorkflows = workflows.filter((w) =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!user) {
    return (
      <div style={{ maxWidth: "800px", margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
        <div className="glass-panel" style={{ padding: "40px" }}>
          <Workflow size={48} color="var(--primary-light)" style={{ margin: "0 auto 16px auto" }} />
          <h2 style={{ fontSize: "1.6rem", fontWeight: "800", marginBottom: "8px" }}>Sign In to Webster Workflows</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "0.95rem" }}>
            Create, persist, validate, and execute directed acyclic graph (DAG) workflows with the Dormammu Engine.
          </p>
          <button
            onClick={() => onOpenAuth("login")}
            className="btn btn-primary"
            style={{ padding: "12px 28px", fontSize: "0.95rem" }}
          >
            Sign In / Sign Up
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1200px", margin: "30px auto", padding: "0 24px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: "800", letterSpacing: "-0.02em" }}>
            Workflows
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginTop: "4px" }}>
            Visual DAG workflow automation and execution engine
          </p>
        </div>

        <button
          onClick={() => setIsTemplateModalOpen(true)}
          style={{
            padding: "10px 20px",
            background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
            border: "none",
            borderRadius: "10px",
            color: "#ffffff",
            fontSize: "0.92rem",
            fontWeight: "700",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 0 20px rgba(124, 58, 237, 0.4)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
          onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
        >
          <Plus size={18} />
          New Workflow
        </button>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: "24px", maxWidth: "380px", position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input
          type="text"
          placeholder="Search workflows..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 14px 10px 38px",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "10px",
            color: "var(--text-primary)",
            fontSize: "0.88rem",
            outline: "none",
          }}
        />
      </div>

      {/* Workflows Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Loader2 size={32} color="var(--primary-light)" className="animate-spin" />
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <div 
          className="glass-panel"
          style={{ 
            textAlign: "center", 
            padding: "60px 20px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <div style={{ width: "50px", height: "50px", borderRadius: "12px", background: "rgba(124,58,237,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Workflow size={24} color="var(--primary-light)" />
          </div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>No Workflows Found</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", maxWidth: "420px" }}>
            Get started by launching a pre-built starter pipeline or create your own custom nodes on the canvas.
          </p>
          <button
            onClick={() => setIsTemplateModalOpen(true)}
            style={{
              padding: "10px 20px",
              background: "var(--primary)",
              border: "1px solid var(--primary-light)",
              borderRadius: "8px",
              color: "#ffffff",
              fontSize: "0.88rem",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Create First Workflow
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
          {filteredWorkflows.map((wf) => (
            <div
              key={wf.id}
              onClick={() => onOpenWorkflow(wf.id)}
              className="glass-panel"
              style={{
                padding: "20px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "16px",
                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "rgba(124, 58, 237, 0.4)";
                e.currentTarget.style.boxShadow = "0 15px 35px rgba(0, 0, 0, 0.5)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0px)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.boxShadow = "0 20px 40px -15px rgba(0, 0, 0, 0.6)";
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px" }}>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "var(--text-primary)" }}>
                    {wf.name}
                  </h3>

                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: "700",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      background: "rgba(124, 58, 237, 0.15)",
                      color: "var(--primary-light)",
                      border: "1px solid rgba(124, 58, 237, 0.3)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    v{wf.latestVersion}
                  </span>
                </div>

                {wf.description && (
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "6px", lineHeight: 1.4 }}>
                    {wf.description}
                  </p>
                )}
              </div>

              {/* Stats & Timestamps */}
              <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Layers size={13} color="var(--primary-light)" />
                    {wf.nodesCount} Nodes
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <GitBranch size={13} color="var(--accent-cyan)" />
                    {wf.edgesCount} Edges
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    onClick={(e) => handleDelete(wf.id, e)}
                    title="Delete Workflow"
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
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#f43f5e")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    <Trash2 size={15} />
                  </button>

                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.06)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-primary)",
                    }}
                  >
                    <ExternalLink size={14} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Starter Template Modal */}
      {isTemplateModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0, 0, 0, 0.8)",
            backdropFilter: "blur(12px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: "100%",
              maxWidth: "600px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: "1.2rem", fontWeight: "800" }}>Choose Starter Template</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                  Select a workflow pipeline configuration to begin
                </p>
              </div>

              <button
                onClick={() => setIsTemplateModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {STARTER_TEMPLATES.map((tmpl) => {
                const IconComponent = tmpl.icon;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => handleCreateFromTemplate(tmpl)}
                    style={{
                      padding: "14px 16px",
                      background: "rgba(255, 255, 255, 0.03)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "10px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = tmpl.color;
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)";
                      e.currentTarget.style.transform = "translateX(4px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-subtle)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                      e.currentTarget.style.transform = "translateX(0px)";
                    }}
                  >
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        borderRadius: "8px",
                        background: `${tmpl.color}22`,
                        color: tmpl.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconComponent size={20} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.95rem", fontWeight: "700", color: "var(--text-primary)" }}>
                        {tmpl.name}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px", lineHeight: 1.3 }}>
                        {tmpl.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
