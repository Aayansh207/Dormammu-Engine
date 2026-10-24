import React, { useState } from "react";
import { 
  Workflow, 
  ArrowRight, 
  Play, 
  ShieldCheck, 
  GitBranch, 
  CheckCircle2, 
  Cpu, 
  Terminal, 
  Layers, 
  Zap, 
  Database, 
  Search, 
  FileCode, 
  Activity, 
  ExternalLink,
  ChevronRight,
  Code2,
  RefreshCw,
  Clock,
  Check,
  Flame,
  Globe,
  Sliders,
  Sun,
  Moon,
  AlertTriangle,
  Radio,
  Boxes,
  Server,
  Repeat
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

// Pre-configured DAG Pipeline Demonstrations
const DAG_PIPELINES = {
  canonical_math: {
    id: "canonical_math",
    name: "Canonical Math Multiply Pipeline",
    description: "Standard 3-node multiply chain (Manual Trigger -> Math Multiply -> Return Output)",
    tag: "Math Multiply",
    nodes: [
      { id: "n1", type: "trigger", title: "Manual Trigger", subtitle: "trigger.manual v1", icon: Zap, color: "#ff5d44", status: "idle" },
      { id: "n2", type: "validator", title: "Topological Validator", subtitle: "Cycle Detection (DFS)", icon: ShieldCheck, color: "#06b6d4", status: "idle" },
      { id: "n3", type: "queue", title: "Redis BullMQ Queue", subtitle: "Priority Enqueue", icon: Server, color: "#8b5cf6", status: "idle" },
      { id: "n4", type: "worker", title: "Math Multiply Worker", subtitle: "math.multiply (factor: 5)", icon: Cpu, color: "#10b981", status: "idle" },
      { id: "n5", type: "output", title: "Return Output (SSE)", subtitle: "output.return v1", icon: CheckCircle2, color: "#ff5d44", status: "idle" }
    ],
    samplePayload: {
      input: { initialValue: 12 },
      stages: [
        { stage: "validate", status: "PASSED", acyclic: true, cycleDetected: false },
        { stage: "queue", jobId: "job_math_8842", queue: "workflow-tasks", attempts: 1 },
        { stage: "worker", operation: "12 * 5", result: 60, latencyMs: 14 },
        { stage: "stream", sseEvent: "task.completed", streamChannel: "run_live_a9e4" }
      ],
      output: { value: 60 },
      executionTime: "38ms",
      status: "SUCCEEDED"
    }
  },
  webhook_backoff: {
    id: "webhook_backoff",
    name: "Event Webhook & Failure Recovery",
    description: "External HTTP webhook with transient failure recovery, exponential backoff, jitter, and dead-letter queue",
    tag: "Webhook & Recovery",
    nodes: [
      { id: "n1", type: "trigger", title: "HTTP Webhook Endpoint", subtitle: "Native Fetch / Ingest", icon: Globe, color: "#ff5d44", status: "idle" },
      { id: "n2", type: "validator", title: "Acyclicity & Schema Check", subtitle: "Contract Verification", icon: ShieldCheck, color: "#06b6d4", status: "idle" },
      { id: "n3", type: "queue", title: "BullMQ Distributed Queue", subtitle: "Dead-Letter Path Guard", icon: Server, color: "#8b5cf6", status: "idle" },
      { id: "n4", type: "recovery", title: "Transient Backoff & Retry", subtitle: "Bounded Jitter Backoff", icon: Repeat, color: "#f59e0b", status: "idle" },
      { id: "n5", type: "output", title: "Persist & SSE Stream", subtitle: "PostgreSQL & SSE Canvas", icon: CheckCircle2, color: "#10b981", status: "idle" }
    ],
    samplePayload: {
      webhookPayload: { event: "order.created", orderId: "ord_9942a", amount: 149.00 },
      recoveryAttempt: {
        attempt: 2,
        maxRetries: 3,
        strategy: "EXPONENTIAL_BACKOFF_WITH_JITTER",
        delayMs: 350,
        idempotencyKey: "idem_ord_9942a_t2"
      },
      output: { status: "PROCESSED", destination: "orders_database", persisted: true },
      executionTime: "118ms",
      status: "RECOVERED_AND_SUCCEEDED"
    }
  },
  json_extractor: {
    id: "json_extractor",
    name: "JSON Pipeline & Path Extractor",
    description: "Multi-node DAG pipeline parsing nested JSON payload and extracting target values through strict topological dependency counts",
    tag: "JSON Transform",
    nodes: [
      { id: "n1", type: "trigger", title: "Cron / Scheduled Run", subtitle: "cron-parser trigger", icon: Clock, color: "#ff5d44", status: "idle" },
      { id: "n2", type: "validator", title: "Dependency Planner", subtitle: "Kahn's Topological Sort", icon: GitBranch, color: "#06b6d4", status: "idle" },
      { id: "n3", type: "queue", title: "Redis Distributed Queue", subtitle: "Worker Concurrency Claim", icon: Server, color: "#8b5cf6", status: "idle" },
      { id: "n4", type: "worker", title: "JSON Parse & Get", subtitle: "json.parse -> json.get", icon: FileCode, color: "#8b5cf6", status: "idle" },
      { id: "n5", type: "output", title: "Return Result Stream", subtitle: "SSE Live Dispatch", icon: CheckCircle2, color: "#10b981", status: "idle" }
    ],
    samplePayload: {
      inputJson: '{"user": {"name": "Alex Morgan", "role": "Senior Engineer", "org": "NexFlow Cloud"}}',
      extractedField: "user.name",
      extractedValue: "Alex Morgan",
      dependencyCountRemaining: 0,
      executionTime: "24ms",
      status: "SUCCEEDED"
    }
  }
};

export default function Hero({ user, onOpenAuth, onNavigateProfile }) {
  const { theme, toggleTheme } = useTheme();
  const [selectedPipelineKey, setSelectedPipelineKey] = useState("canonical_math");
  const [isSimulating, setIsSimulating] = useState(false);
  const [activeSimulationNodeIndex, setActiveSimulationNodeIndex] = useState(-1);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState(null);

  const activePipeline = DAG_PIPELINES[selectedPipelineKey];

  const handleSelectPipeline = (key) => {
    setSelectedPipelineKey(key);
    setActiveSimulationNodeIndex(-1);
    setSelectedNodeDetails(null);
  };

  const handleRunSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setActiveSimulationNodeIndex(0);
    setSelectedNodeDetails(activePipeline.nodes[0]);

    const totalNodes = activePipeline.nodes.length;
    let step = 0;

    const interval = setInterval(() => {
      step += 1;
      if (step < totalNodes) {
        setActiveSimulationNodeIndex(step);
        setSelectedNodeDetails(activePipeline.nodes[step]);
      } else {
        clearInterval(interval);
        setTimeout(() => {
          setIsSimulating(false);
          setActiveSimulationNodeIndex(totalNodes);
        }, 500);
      }
    }, 700);
  };

  return (
    <div style={{ position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", width: "100%" }}>
      {/* Background Dot Matrix Pattern */}
      <div className="hero-dot-pattern" aria-hidden="true" />
      <div className="hero-radial-glow" aria-hidden="true" />

      {/* =====================================================================
          1. HERO HEADER SECTION
          ===================================================================== */}
      <section 
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "52px 20px 36px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center"
        }}
      >
        {/* Top Product Announcement Capsule Pill */}
        <div 
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 18px",
            borderRadius: "var(--radius-full)",
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-xs)",
            color: "var(--text-secondary)",
            fontSize: "0.82rem",
            fontWeight: "600",
            marginBottom: "24px",
            transition: "all 0.2s ease",
            cursor: "pointer"
          }}
          onClick={() => onNavigateProfile()}
        >
          <span 
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "var(--brand)",
              color: "#ffffff"
            }}
          >
            <GitBranch size={11} />
          </span>
          <span style={{ color: "var(--text-primary)", fontWeight: "700" }}>NexFlow Engine v2.0</span>
          <span style={{ color: "var(--text-muted)" }}>•</span>
          <span>Event-Driven Distributed DAG Architecture</span>
          <ArrowRight size={13} style={{ color: "var(--brand)" }} />
        </div>

        {/* Hero Title */}
        <h1 
          style={{
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            fontWeight: "800",
            letterSpacing: "-0.04em",
            lineHeight: "1.06",
            maxWidth: "980px",
            marginBottom: "20px",
            color: "var(--text-primary)"
          }}
        >
          Deterministic DAG Execution. <br />
          Distributed by{" "}
          <span 
            style={{
              position: "relative",
              display: "inline-block",
              background: "linear-gradient(135deg, #ff5d44 0%, #ff8c42 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent"
            }}
          >
            NexFlow.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p 
          style={{
            fontSize: "clamp(1.05rem, 1.8vw, 1.22rem)",
            color: "var(--text-secondary)",
            maxWidth: "760px",
            lineHeight: "1.6",
            marginBottom: "32px",
            fontWeight: "400"
          }}
        >
          NexFlow is an event-driven workflow automation platform that enables users to build and 
          execute distributed pipelines using Directed Acyclic Graphs (DAG). Connect triggers, 
          transformation functions, HTTP webhooks, and delays through an intuitive visual canvas 
          with live Server-Sent Events.
        </p>

        {/* CTA Buttons */}
        <div 
          style={{ 
            display: "flex", 
            gap: "12px", 
            flexWrap: "wrap", 
            justifyContent: "center",
            marginBottom: "36px" 
          }}
        >
          {user ? (
            <button
              onClick={onNavigateProfile}
              className="btn btn-primary"
              style={{
                padding: "13px 28px",
                fontSize: "1rem",
                borderRadius: "var(--radius-full)"
              }}
            >
              <Workflow size={18} />
              Launch Workflow Builder
            </button>
          ) : (
            <button
              onClick={() => onOpenAuth("signup")}
              className="btn btn-primary"
              style={{
                padding: "13px 28px",
                fontSize: "1rem",
                borderRadius: "var(--radius-full)"
              }}
            >
              Get Started Free
              <ArrowRight size={18} />
            </button>
          )}

          <a
            href="#architecture"
            className="btn btn-secondary"
            style={{
              padding: "13px 24px",
              fontSize: "1rem",
              borderRadius: "var(--radius-full)",
              textDecoration: "none"
            }}
          >
            Explore Architecture
          </a>
        </div>

        {/* =====================================================================
            2. INTERACTIVE DAG SIMULATOR
            ===================================================================== */}
        <div 
          style={{
            width: "100%",
            maxWidth: "1160px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xl)",
            padding: "20px 24px",
            boxShadow: "var(--shadow-card)",
            marginBottom: "36px",
            textAlign: "left",
            transition: "all 0.25s ease"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div 
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "var(--brand-light)",
                  color: "var(--brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Cpu size={18} />
              </div>
              <div>
                <span style={{ fontSize: "0.85rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--brand)" }}>
                  Interactive DAG Execution Simulator
                </span>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Directed Acyclic Graph • Topological Cycle Detection • Redis BullMQ
                </div>
              </div>
            </div>

            {/* Run Simulation Action */}
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="btn btn-primary"
              style={{
                padding: "9px 20px",
                fontSize: "0.88rem",
                height: "38px",
                borderRadius: "var(--radius-full)"
              }}
            >
              {isSimulating ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  Simulating Execution...
                </>
              ) : (
                <>
                  <Play size={15} />
                  Simulate DAG Execution
                </>
              )}
            </button>
          </div>

          {/* Pipeline Selector Chips */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
            <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontWeight: "600" }}>
              Pipeline Templates:
            </span>
            {Object.keys(DAG_PIPELINES).map((key) => {
              const item = DAG_PIPELINES[key];
              const isSelected = selectedPipelineKey === key;
              return (
                <button
                  key={key}
                  onClick={() => handleSelectPipeline(key)}
                  style={{
                    background: isSelected ? "var(--brand)" : "var(--bg-chip)",
                    color: isSelected ? "#ffffff" : "var(--text-secondary)",
                    border: "1px solid " + (isSelected ? "var(--brand)" : "var(--border-subtle)"),
                    borderRadius: "var(--radius-full)",
                    padding: "5px 14px",
                    fontSize: "0.8rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {item.tag}
                </button>
              );
            })}
          </div>

          {/* Interactive DAG Band Nodes (Horizontal Flow) */}
          <div 
            style={{
              background: "var(--canvas-bg)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-lg)",
              padding: "24px 20px",
              overflowX: "auto"
            }}
          >
            <div 
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                minWidth: "780px",
                position: "relative"
              }}
            >
              {activePipeline.nodes.map((node, index) => {
                const isPassed = activeSimulationNodeIndex > index;
                const isCurrent = activeSimulationNodeIndex === index;
                const IconComponent = node.icon;

                let nodeStatus = "IDLE";
                let borderColor = "var(--border-subtle)";
                let glowEffect = "none";

                if (isCurrent) {
                  nodeStatus = "RUNNING";
                  borderColor = "var(--brand)";
                  glowEffect = "0 0 16px var(--brand-glow)";
                } else if (isPassed) {
                  nodeStatus = "SUCCEEDED";
                  borderColor = "var(--accent-emerald)";
                  glowEffect = "0 0 10px rgba(16, 185, 129, 0.25)";
                }

                return (
                  <React.Fragment key={node.id}>
                    {/* Node Card */}
                    <div
                      onClick={() => setSelectedNodeDetails(node)}
                      style={{
                        width: "160px",
                        background: isCurrent ? "var(--brand-light)" : "var(--bg-card)",
                        border: `1.5px solid ${borderColor}`,
                        borderRadius: "var(--radius-md)",
                        padding: "12px 14px",
                        cursor: "pointer",
                        boxShadow: glowEffect,
                        transition: "all 0.25s ease",
                        position: "relative",
                        zIndex: 2
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div 
                          style={{
                            width: "28px",
                            height: "28px",
                            borderRadius: "6px",
                            background: `${node.color}20`,
                            color: node.color,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <IconComponent size={15} />
                        </div>

                        <span
                          style={{
                            fontSize: "0.65rem",
                            fontWeight: "800",
                            padding: "2px 6px",
                            borderRadius: "var(--radius-full)",
                            background: isCurrent ? "var(--brand)" : isPassed ? "var(--accent-emerald)" : "var(--bg-chip)",
                            color: isCurrent || isPassed ? "#fff" : "var(--text-muted)"
                          }}
                        >
                          {nodeStatus}
                        </span>
                      </div>

                      <div style={{ fontSize: "0.84rem", fontWeight: "700", color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {node.title}
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {node.subtitle}
                      </div>
                    </div>

                    {/* Connecting Bezier / Arrow */}
                    {index < activePipeline.nodes.length - 1 && (
                      <div 
                        style={{ 
                          flex: 1, 
                          height: "2px", 
                          background: isPassed ? "var(--accent-emerald)" : isCurrent ? "var(--brand)" : "var(--border-subtle)",
                          margin: "0 10px",
                          position: "relative",
                          transition: "background 0.3s ease"
                        }}
                      >
                        <div 
                          style={{
                            position: "absolute",
                            right: "-4px",
                            top: "-4px",
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: isPassed ? "var(--accent-emerald)" : isCurrent ? "var(--brand)" : "var(--border-subtle)",
                            transition: "background 0.3s ease"
                          }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Real Live Payload Inspection Box */}
          <div 
            style={{
              marginTop: "16px",
              padding: "14px 16px",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "16px",
              flexWrap: "wrap"
            }}
          >
            <div style={{ flex: 1, minWidth: "260px" }}>
              <div style={{ fontSize: "0.82rem", fontWeight: "700", color: "var(--text-primary)", marginBottom: "4px" }}>
                {activePipeline.name}
              </div>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.4 }}>
                {activePipeline.description}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", fontSize: "0.78rem" }}>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Execution Mode: </span>
                <strong style={{ color: "var(--brand)" }}>Redis + BullMQ Worker</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Cycle Check: </span>
                <strong style={{ color: "var(--accent-emerald)" }}>Topological Clean (DAG)</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)" }}>Streaming: </span>
                <strong style={{ color: "var(--accent-cyan)" }}>Server-Sent Events (SSE)</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. PROCESS FLOW (7-Step Architecture)
          ===================================================================== */}
      <section 
        id="process-flow"
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "40px 20px 60px",
          textAlign: "center"
        }}
      >
        <span 
          style={{
            fontSize: "0.8rem",
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--brand)",
            marginBottom: "12px",
            display: "inline-block"
          }}
        >
          Execution Lifecycle
        </span>

        <h2 
          style={{
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: "800",
            letterSpacing: "-0.03em",
            maxWidth: "840px",
            margin: "0 auto 16px",
            color: "var(--text-primary)"
          }}
        >
          How NexFlow Automates Distributed Workflows
        </h2>

        <p 
          style={{
            fontSize: "1.05rem",
            color: "var(--text-secondary)",
            maxWidth: "680px",
            margin: "0 auto 40px"
          }}
        >
          From interactive graph design to distributed worker execution and Server-Sent Events live updates.
        </p>

        {/* 7-Step Grid */}
        <div 
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "16px",
            textAlign: "left"
          }}
        >
          {[
            { step: "01", title: "Design", desc: "The user creates a workflow on the visual canvas by connecting trigger and task nodes with directed edges." },
            { step: "02", title: "Validate", desc: "The backend validates node types, required configuration, edges, and graph acyclicity. Invalid workflows are rejected before execution." },
            { step: "03", title: "Start", desc: "A workflow run is created through a webhook endpoint, a cron schedule, or a manual run action. Trigger payloads become initial input." },
            { step: "04", title: "Plan", desc: "The engine calculates dependency counts and schedules only nodes whose prerequisites have succeeded." },
            { step: "05", title: "Execute", desc: "Ready node jobs are placed on the Redis-backed BullMQ queue. Distributed workers claim jobs, execute, and persist outputs." },
            { step: "06", title: "Recover", desc: "Transient failures are retried with bounded exponential backoff and jitter. Exhausted jobs route to a dead-letter path." },
            { step: "07", title: "Observe", desc: "Status changes, timestamps, outputs, and execution logs are stored in PostgreSQL and streamed to the canvas through SSE." }
          ].map((item) => (
            <div 
              key={item.step}
              className="glass-panel"
              style={{
                padding: "22px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                position: "relative"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "1.2rem", fontWeight: "900", color: "var(--brand)", fontFamily: "var(--font-mono)" }}>
                  {item.step}
                </span>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--brand)" }} />
              </div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-primary)" }}>
                {item.title}
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* =====================================================================
          4. CORE ENGINEERING ARCHITECTURE & STRATEGY
          ===================================================================== */}
      <section 
        id="architecture"
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          padding: "40px 20px 80px",
          textAlign: "left"
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "44px" }}>
          <span 
            style={{
              fontSize: "0.8rem",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--brand)",
              marginBottom: "12px",
              display: "inline-block"
            }}
          >
            Core Engineering Architecture
          </span>

          <h2 
            style={{
              fontSize: "clamp(2rem, 4vw, 3rem)",
              fontWeight: "800",
              letterSpacing: "-0.03em",
              maxWidth: "800px",
              margin: "0 auto 16px",
              color: "var(--text-primary)"
            }}
          >
            Infrastructure Layout &amp; Data Flow
          </h2>

          <p style={{ fontSize: "1.05rem", color: "var(--text-secondary)", maxWidth: "680px", margin: "0 auto" }}>
            Separating API and worker processes prevents long-running tasks from blocking incoming requests.
          </p>
        </div>

        <div 
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "24px"
          }}
        >
          {/* Smart Engineering Approach */}
          <div className="glass-panel" style={{ padding: "30px 26px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "var(--brand-light)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Server size={20} />
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>Smart Engineering Approach</h3>
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.6" }}>
              Uses Redis/BullMQ, independent workers, persisted node attempts, dependency-aware scheduling, and 
              bounded retries with exponential backoff and jitter. Idempotency keys and database constraints 
              reduce duplicate execution.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><Check size={14} color="var(--brand)" /> Bounded queue concurrency &amp; HTTP timeouts</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><Check size={14} color="var(--brand)" /> Graceful shutdown &amp; worker heartbeats</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><Check size={14} color="var(--brand)" /> Dead-letter queue routing on retry exhaustion</li>
            </ul>
          </div>

          {/* Failure Modes & Guarantees */}
          <div className="glass-panel" style={{ padding: "30px 26px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "rgba(16, 185, 129, 0.15)", color: "var(--accent-emerald)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldCheck size={20} />
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>Execution Guarantees</h3>
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: "1.6" }}>
              Executing workflows sequentially inside HTTP requests causes latency and lost work on interruption. 
              NexFlow isolates workload spikes, keeps the REST API responsive, enforces DAG dependency correctness, 
              and follows at-least-once external semantics.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><Check size={14} color="var(--accent-emerald)" /> Transactional state transitions via Prisma</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><Check size={14} color="var(--accent-emerald)" /> Crash recovery through reconciliation</li>
              <li style={{ display: "flex", alignItems: "center", gap: "8px" }}><Check size={14} color="var(--accent-emerald)" /> Dependent nodes blocked after prerequisite failure</li>
            </ul>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. PRODUCT FOOTER
          ===================================================================== */}
      <footer 
        style={{
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-card)",
          padding: "48px 20px 24px",
          marginTop: "auto"
        }}
      >
        <div 
          style={{
            maxWidth: "1240px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "32px",
            marginBottom: "36px"
          }}
        >
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div 
                style={{
                  width: "30px",
                  height: "30px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #ff5d44 0%, #ff8c42 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: "800",
                  fontSize: "0.9rem"
                }}
              >
                N
              </div>
              <span style={{ fontSize: "1.2rem", fontWeight: "800", letterSpacing: "-0.03em", color: "var(--text-primary)" }}>
                NexFlow
              </span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: "1.6", maxWidth: "300px" }}>
              The visual, event-driven DAG platform for distributed workflow automation, deterministic task scheduling, and real-time execution observability.
            </p>
          </div>

          {/* Product Links */}
          <div>
            <h4 style={{ fontSize: "0.85rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-primary)", marginBottom: "12px" }}>
              Product
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.84rem" }}>
              <button 
                onClick={onNavigateProfile}
                style={{ background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", textAlign: "left", padding: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                Workflow DAG Builder
              </button>
              <a 
                href="#process-flow"
                style={{ color: "var(--text-secondary)", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                Execution Lifecycle
              </a>
              <a 
                href="#architecture"
                style={{ color: "var(--text-secondary)", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--brand)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                Infrastructure Architecture
              </a>
            </div>
          </div>

          {/* Features */}
          <div>
            <h4 style={{ fontSize: "0.85rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-primary)", marginBottom: "12px" }}>
              Features
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.84rem", color: "var(--text-secondary)" }}>
              <span>Topological Cycle Detection</span>
              <span>Distributed BullMQ Queues</span>
              <span>Exponential Backoff Retries</span>
              <span>Server-Sent Events (SSE)</span>
            </div>
          </div>

          {/* Appearance & Engine Health */}
          <div>
            <h4 style={{ fontSize: "0.85rem", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-primary)", marginBottom: "12px" }}>
              Preferences
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={toggleTheme}
                className="btn btn-secondary"
                style={{ padding: "6px 14px", fontSize: "0.8rem", height: "34px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                {theme === "light" ? <Moon size={14} /> : <Sun size={14} color="#fbbf24" />}
                {theme === "light" ? "Switch to Dark Mode" : "Switch to Light Mode"}
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.78rem", color: "var(--accent-emerald)", fontWeight: "600" }}>
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--accent-emerald)" }} />
                NexFlow Engine Operational
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div 
          style={{
            maxWidth: "1240px",
            margin: "0 auto",
            paddingTop: "20px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.78rem",
            color: "var(--text-muted)",
            flexWrap: "wrap",
            gap: "10px"
          }}
        >
          <span>© {new Date().getFullYear()} NexFlow Inc. All rights reserved.</span>
          <span>Event-Driven Distributed DAG Automation</span>
        </div>
      </footer>
    </div>
  );
}
