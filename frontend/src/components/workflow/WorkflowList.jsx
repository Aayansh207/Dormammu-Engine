import React, { useState, useEffect } from "react";
import { 
  Plus, 
  Workflow, 
  Trash2, 
  ExternalLink, 
  Clock, 
  Layers, 
  GitBranch, 
  Search, 
  Sparkles, 
  Loader2, 
  Calculator, 
  FileJson,
  X,
  Check
} from "lucide-react";
import { api } from "../../services/api";

const STARTER_TEMPLATES = [
  {
    id: "blank",
    name: "Blank Canvas",
    description: "Clean slate with an initial Manual Trigger node ready to wire",
    icon: Workflow,
    color: "#39AEA9",
    definition: {
      schemaVersion: 1,
      name: "Untitled Workflow",
      nodes: [
        {
          id: "trigger_01",
          type: "trigger.manual",
          version: 1,
          name: "Manual Trigger",
          position: { x: 160, y: 180 },
          config: {},
        },
      ],
      edges: [],
    },
  },
  {
    id: "canonical_math",
    name: "Canonical Math Multiply",
    description: "Standard 3-node multiply chain (Manual Trigger -> Math Multiply -> Return)",
    icon: Calculator,
    color: "#39AEA9",
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
    color: "#557B83",
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
    id: "branching_math",
    name: "Branching Math Pipeline",
    description: "Multi-branch DAG: Manual Trigger branches into Add and Multiply, converging in Subtract",
    icon: GitBranch,
    color: "#557B83",
    definition: {
      schemaVersion: 1,
      name: "Branching Math Pipeline",
      nodes: [
        {
          id: "trigger_01",
          type: "trigger.manual",
          version: 1,
          name: "Manual Trigger (Start: 20)",
          position: { x: 100, y: 180 },
          config: { defaultPayload: 20 },
        },
        {
          id: "add_01",
          type: "math.add",
          version: 1,
          name: "Add 10",
          position: { x: 380, y: 100 },
          config: { b: 10 },
        },
        {
          id: "multiply_01",
          type: "math.multiply",
          version: 1,
          name: "Multiply by 2",
          position: { x: 380, y: 260 },
          config: { factor: 2 },
        },
        {
          id: "sub_01",
          type: "math.subtract",
          version: 1,
          name: "Subtract Nodes",
          position: { x: 680, y: 180 },
          config: {},
        },
        {
          id: "output_01",
          type: "output.return",
          version: 1,
          name: "Return Result",
          position: { x: 960, y: 180 },
          config: {},
        },
      ],
      edges: [
        {
          id: "edge_01",
          source: "trigger_01",
          sourcePort: "output",
          target: "add_01",
          targetPort: "input",
        },
        {
          id: "edge_02",
          source: "trigger_01",
          sourcePort: "output",
          target: "multiply_01",
          targetPort: "input",
        },
        {
          id: "edge_03",
          source: "multiply_01",
          sourcePort: "output",
          target: "sub_01",
          targetPort: "a",
        },
        {
          id: "edge_04",
          source: "add_01",
          sourcePort: "output",
          target: "sub_01",
          targetPort: "b",
        },
        {
          id: "edge_05",
          source: "sub_01",
          sourcePort: "output",
          target: "output_01",
          targetPort: "input",
        },
      ],
    },
  },
  {
    id: "uuid_generator",
    name: "UUID & Timestamp Generator",
    description: "Generate unique identifiers and format timestamps via utility nodes",
    icon: Sparkles,
    color: "#39AEA9",
    definition: {
      schemaVersion: 1,
      name: "UUID & Timestamp Generator",
      nodes: [
        {
          id: "trigger_01",
          type: "trigger.manual",
          version: 1,
          name: "Trigger Event",
          position: { x: 100, y: 180 },
          config: {},
        },
        {
          id: "uuid_01",
          type: "utility.uuid",
          version: 1,
          name: "Generate UUID",
          position: { x: 380, y: 100 },
          config: {},
        },
        {
          id: "dt_01",
          type: "utility.datetime",
          version: 1,
          name: "Current Datetime",
          position: { x: 380, y: 260 },
          config: { format: "iso" },
        },
        {
          id: "concat_01",
          type: "text.concat",
          version: 1,
          name: "Combine Tokens",
          position: { x: 680, y: 180 },
          config: { separator: " @ " },
        },
        {
          id: "output_01",
          type: "output.return",
          version: 1,
          name: "Return Token",
          position: { x: 960, y: 180 },
          config: {},
        },
      ],
      edges: [
        {
          id: "edge_01",
          source: "uuid_01",
          sourcePort: "output",
          target: "concat_01",
          targetPort: "a",
        },
        {
          id: "edge_02",
          source: "dt_01",
          sourcePort: "output",
          target: "concat_01",
          targetPort: "b",
        },
        {
          id: "edge_03",
          source: "concat_01",
          sourcePort: "output",
          target: "output_01",
          targetPort: "input",
        },
      ],
    },
  },
];

export default function WorkflowList({ onOpenWorkflow, user, onOpenAuth }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("Untitled Workflow");
  const [selectedTemplateId, setSelectedTemplateId] = useState("blank");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadWorkflows();
  }, [user?.id]);

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

  // Instant 1-click Blank Workflow creation
  const handleCreateBlankWorkflow = async () => {
    setIsCreating(true);
    try {
      const res = await api.createWorkflow({
        name: "Untitled Workflow",
        description: "",
        definition: {
          schemaVersion: 1,
          name: "Untitled Workflow",
          nodes: [
            {
              id: "trigger_01",
              type: "trigger.manual",
              version: 1,
              name: "Manual Trigger",
              position: { x: 160, y: 180 },
              config: {},
            },
          ],
          edges: [],
        },
      });

      if (res && res.data) {
        onOpenWorkflow(res.data.id);
      }
    } catch (err) {
      console.error("Failed to create workflow:", err);
      alert(`Failed to create workflow: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Create workflow from selected template with custom name
  const handleConfirmCreate = async () => {
    setIsCreating(true);
    try {
      const selectedTmpl = STARTER_TEMPLATES.find((t) => t.id === selectedTemplateId) || STARTER_TEMPLATES[0];
      const wfName = newWorkflowName.trim() || selectedTmpl.name;
      const res = await api.createWorkflow({
        name: wfName,
        description: selectedTmpl.description,
        definition: {
          ...selectedTmpl.definition,
          name: wfName,
        },
      });

      if (res && res.data) {
        setIsCreateModalOpen(false);
        onOpenWorkflow(res.data.id);
      }
    } catch (err) {
      console.error("Failed to create workflow:", err);
      alert(`Failed to create workflow: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Direct create from template item
  const handleCreateFromTemplate = async (template) => {
    setIsCreating(true);
    try {
      const res = await api.createWorkflow({
        name: template.name,
        description: template.description,
        definition: template.definition,
      });

      if (res && res.data) {
        setIsCreateModalOpen(false);
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
          <Workflow size={48} color="var(--brand)" style={{ margin: "0 auto 16px auto" }} />
          <h2 style={{ fontSize: "1.6rem", fontWeight: "800", marginBottom: "8px", color: "var(--text-primary)" }}>Sign In to Dormammu</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "0.95rem" }}>
            Build, validate, persist, and execute directed acyclic graph (DAG) pipelines with precision.
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

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Quick 1-Click Blank Canvas */}
          <button
            onClick={handleCreateBlankWorkflow}
            disabled={isCreating}
            className="btn btn-secondary"
            title="Start from scratch with 1 click"
            style={{
              padding: "9px 16px",
              fontSize: "0.88rem",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              borderRadius: "var(--radius-full)",
            }}
          >
            <Workflow size={15} color="var(--brand)" />
            Blank Canvas
          </button>

          {/* New Workflow Modal Trigger */}
          <button
            onClick={() => {
              setNewWorkflowName("Untitled Workflow");
              setSelectedTemplateId("blank");
              setIsCreateModalOpen(true);
            }}
            disabled={isCreating}
            className="btn btn-primary"
            style={{
              padding: "9px 20px",
              fontSize: "0.92rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "var(--radius-full)",
            }}
          >
            {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
            {isCreating ? "Creating..." : "New Workflow"}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: "24px", maxWidth: "380px", position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
        <input
          type="text"
          placeholder="Search workflows..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="input-control"
          style={{
            paddingLeft: "40px",
            borderRadius: "var(--radius-full)"
          }}
        />
      </div>

      {/* Workflows Grid / Empty State */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0" }}>
          <Loader2 size={32} color="var(--brand)" className="animate-spin" />
        </div>
      ) : filteredWorkflows.length === 0 ? (
        <div 
          className="glass-panel"
          style={{ 
            padding: "40px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <div style={{ textAlign: "center", maxWidth: "560px", margin: "0 auto" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "var(--brand-light)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px auto" }}>
              <Workflow size={24} color="var(--brand)" />
            </div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: "800", color: "var(--text-primary)" }}>Create Your First Workflow</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.88rem", marginTop: "6px" }}>
              Click any starter card below to launch into the visual editor instantly.
            </p>
          </div>

          {/* Quick starter cards grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
            {STARTER_TEMPLATES.map((tmpl) => {
              const IconComp = tmpl.icon;
              return (
                <div
                  key={tmpl.id}
                  onClick={() => handleCreateFromTemplate(tmpl)}
                  style={{
                    padding: "18px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "12px",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = tmpl.color;
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = "var(--shadow-md)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-subtle)";
                    e.currentTarget.style.transform = "translateY(0px)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "8px",
                        background: `${tmpl.color}22`,
                        color: tmpl.color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IconComp size={18} />
                    </div>
                    <span style={{ fontSize: "0.92rem", fontWeight: "700", color: "var(--text-primary)" }}>
                      {tmpl.name}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                    {tmpl.description}
                  </p>
                  <span style={{ fontSize: "0.75rem", color: "var(--brand)", fontWeight: "600", marginTop: "auto", display: "flex", alignItems: "center", gap: "4px" }}>
                    Start with this →
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "18px" }}>
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
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.borderColor = "var(--brand)";
                e.currentTarget.style.boxShadow = "var(--shadow-lg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0px)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
                e.currentTarget.style.boxShadow = "var(--shadow-card)";
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
                      background: "var(--brand-light)",
                      color: "var(--brand)",
                      border: "1px solid var(--brand-border)",
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
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <Layers size={13} color="var(--brand)" />
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
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-rose)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  >
                    <Trash2 size={15} />
                  </button>

                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "6px",
                      background: "var(--bg-chip)",
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

      {/* Streamlined Create Workflow Modal */}
      {isCreateModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
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
              maxWidth: "580px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              border: "1px solid var(--border-medium)",
              background: "var(--bg-card)",
              boxShadow: "var(--shadow-xl)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: "800", color: "var(--text-primary)" }}>Create New Workflow</h3>
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: "2px" }}>
                  Name your workflow and choose a starting point
                </p>
              </div>

              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem", padding: "4px" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Workflow Name Input */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Workflow Name
              </label>
              <input
                type="text"
                value={newWorkflowName}
                autoFocus
                onChange={(e) => setNewWorkflowName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleConfirmCreate();
                  }
                }}
                placeholder="e.g. Order Processing Pipeline"
                className="input-control"
                style={{ padding: "10px 14px", fontSize: "0.95rem", fontWeight: "600" }}
              />
            </div>

            {/* Template Selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase" }}>
                Choose Starting Setup
              </label>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }} className="custom-scrollbar">
                {STARTER_TEMPLATES.map((tmpl) => {
                  const IconComp = tmpl.icon;
                  const isSelected = selectedTemplateId === tmpl.id;

                  return (
                    <div
                      key={tmpl.id}
                      onClick={() => setSelectedTemplateId(tmpl.id)}
                      style={{
                        padding: "12px 14px",
                        background: isSelected ? "var(--brand-light)" : "var(--bg-secondary)",
                        border: `1.5px solid ${isSelected ? "var(--brand)" : "var(--border-subtle)"}`,
                        borderRadius: "10px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          background: `${tmpl.color}22`,
                          color: tmpl.color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconComp size={17} />
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "0.9rem", fontWeight: "700", color: "var(--text-primary)" }}>
                          {tmpl.name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px", lineHeight: 1.3 }}>
                          {tmpl.description}
                        </div>
                      </div>

                      {isSelected && (
                        <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Check size={12} color="#ffffff" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "10px", paddingTop: "6px", borderTop: "1px solid var(--border-subtle)" }}>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: "8px 16px", fontSize: "0.85rem" }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCreate}
                disabled={isCreating}
                className="btn btn-primary"
                style={{ padding: "8px 22px", fontSize: "0.88rem", display: "flex", alignItems: "center", gap: "6px" }}
              >
                {isCreating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={16} />}
                {isCreating ? "Creating..." : "Create Workflow"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
