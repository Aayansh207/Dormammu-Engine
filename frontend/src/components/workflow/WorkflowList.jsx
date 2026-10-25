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
  Check,
  Zap
} from "lucide-react";
import { api } from "../../services/api";

const STARTER_TEMPLATES = [
  {
    id: "dormammu_ops_center",
    name: "Dormammu AI Operations Center",
    description: "Autonomous multi-stage incident triage and operations center engine: validates inbound payloads, performs parallel AI classification and business impact scoring, routes across severity tiers, and produces structured operational reports",
    icon: Sparkles,
    color: "#39AEA9",
    definition: {
      schemaVersion: 1,
      name: "Dormammu AI Operations Center",
      samplePayload: {
        ticketId: "TCK-8092",
        title: "Payment gateway returning HTTP 504 errors",
        description: "Multiple users cannot complete checkout.",
        service: "payment-gateway",
        customerTier: "enterprise",
        affectedUsers: 1200,
        errorRate: 0.42,
        region: "ap-south-1",
        source: "support-webhook"
      },
      nodes: [
        {
          id: "trig_ops",
          type: "trigger.manual",
          version: 1,
          name: "Inbound Incident Ingestion",
          position: { x: 60, y: 280 },
          config: {
            defaultPayload: {
              ticketId: "TCK-8092",
              title: "Payment gateway returning HTTP 504 errors",
              description: "Multiple users cannot complete checkout.",
              service: "payment-gateway",
              customerTier: "enterprise",
              affectedUsers: 1200,
              errorRate: 0.42,
              region: "ap-south-1",
              source: "support-webhook"
            }
          }
        },
        {
          id: "validate_incident",
          type: "data.validate",
          version: 1,
          name: "Validate Incident Schema",
          position: { x: 300, y: 280 },
          config: {
            requiredFields: [
              "ticketId",
              "title",
              "service",
              "customerTier",
              "affectedUsers",
              "errorRate"
            ],
            rules: {
              errorRate: { type: "number", min: 0, max: 1 },
              affectedUsers: { type: "number", min: 0 }
            }
          }
        },
        {
          id: "normalize_incident",
          type: "data.object",
          version: 1,
          name: "Normalize Incident",
          position: { x: 540, y: 280 },
          config: {
            fields: [
              { key: "ticketId", fromInput: true },
              { key: "title", fromInput: true },
              { key: "description", fromInput: true },
              { key: "service", fromInput: true },
              { key: "customerTier", fromInput: true },
              { key: "affectedUsers", fromInput: true },
              { key: "errorRate", fromInput: true },
              { key: "region", fromInput: true },
              { key: "source", fromInput: true }
            ]
          }
        },
        {
          id: "ai_classifier",
          type: "ai.classify",
          version: 1,
          name: "AI Incident Classifier",
          position: { x: 840, y: 140 },
          config: {
            categories: [
              "service_outage",
              "performance_degradation",
              "support_inquiry"
            ],
            instructions: "Classify critical payment timeouts and gateway failures as service_outage, latency as performance_degradation, and invoices as support_inquiry"
          }
        },
        {
          id: "get_affected_users",
          type: "json.get",
          version: 1,
          name: "Extract Affected Users",
          position: { x: 840, y: 360 },
          config: {
            path: "affectedUsers"
          }
        },
        {
          id: "get_error_rate",
          type: "json.get",
          version: 1,
          name: "Extract Error Rate",
          position: { x: 840, y: 480 },
          config: {
            path: "errorRate"
          }
        },
        {
          id: "calc_raw_impact",
          type: "math.multiply",
          version: 1,
          name: "Users * Error Rate",
          position: { x: 1080, y: 420 },
          config: {}
        },
        {
          id: "calc_scale_impact",
          type: "math.multiply",
          version: 1,
          name: "Scale Impact Score",
          position: { x: 1300, y: 420 },
          config: {
            factor: 0.190476
          }
        },
        {
          id: "calc_impact_score",
          type: "math.round",
          version: 1,
          name: "Round Impact Score",
          position: { x: 1520, y: 420 },
          config: {
            precision: 0,
            mode: "round"
          }
        },
        {
          id: "build_impact_summary",
          type: "data.object",
          version: 1,
          name: "Build Impact Summary",
          position: { x: 1740, y: 420 },
          config: {
            targetKey: "impactScore",
            fields: [
              { key: "affectedUsers", fromInput: true },
              { key: "errorRate", fromInput: true },
              { key: "customerTier", fromInput: true }
            ]
          }
        },
        {
          id: "route_switch",
          type: "logic.switch",
          version: 1,
          name: "Severity Router",
          position: { x: 1100, y: 140 },
          config: {
            cases: ["critical", "warning", "normal"]
          }
        },
        {
          id: "action_critical",
          type: "text.template",
          version: 1,
          name: "Dispatch Critical Escalation",
          position: { x: 1400, y: 20 },
          config: {
            template: "🚨 CRITICAL OUTAGE ESCALATION: Ticket {{ticketId}} on [{{service}}]. Dispatched emergency DevOps on-call pager."
          }
        },
        {
          id: "action_warning",
          type: "text.template",
          version: 1,
          name: "Queue Investigation Notice",
          position: { x: 1400, y: 120 },
          config: {
            template: "⚠️ WARNING INVESTIGATION: Ticket {{ticketId}} on [{{service}}]. Flagged for prompt engineering investigation."
          }
        },
        {
          id: "action_normal",
          type: "text.template",
          version: 1,
          name: "Standard Support Response",
          position: { x: 1400, y: 220 },
          config: {
            template: "📋 STANDARD SUPPORT: Ticket {{ticketId}} on [{{service}}]. Created standard business-hours response."
          }
        },
        {
          id: "merge_actions",
          type: "flow.merge",
          version: 1,
          name: "Merge Action Output",
          position: { x: 1700, y: 120 },
          config: {
            mode: "first_available"
          }
        },
        {
          id: "assemble_final_report",
          type: "data.object",
          version: 1,
          name: "Assemble Operations Report",
          position: { x: 1960, y: 260 },
          config: {
            targetKey: "actionSummary",
            fields: [
              { key: "ticketId", fromInput: true },
              { key: "service", fromInput: true },
              { key: "customerTier", fromInput: true },
              { key: "affectedUsers", fromInput: true },
              { key: "errorRate", fromInput: true }
            ]
          }
        },
        {
          id: "ops_return",
          type: "output.return",
          version: 1,
          name: "Final Operations Report",
          position: { x: 2200, y: 260 },
          config: {}
        }
      ],
      edges: [
        { id: "e01", source: "trig_ops", sourcePort: "output", target: "validate_incident", targetPort: "input" },
        { id: "e02", source: "validate_incident", sourcePort: "output", target: "normalize_incident", targetPort: "input" },
        { id: "e03", source: "normalize_incident", sourcePort: "output", target: "ai_classifier", targetPort: "text" },
        { id: "e04", source: "normalize_incident", sourcePort: "output", target: "get_affected_users", targetPort: "input" },
        { id: "e05", source: "normalize_incident", sourcePort: "output", target: "get_error_rate", targetPort: "input" },
        { id: "e06", source: "get_affected_users", sourcePort: "output", target: "calc_raw_impact", targetPort: "a" },
        { id: "e07", source: "get_error_rate", sourcePort: "output", target: "calc_raw_impact", targetPort: "b" },
        { id: "e08", source: "calc_raw_impact", sourcePort: "output", target: "calc_scale_impact", targetPort: "input" },
        { id: "e09", source: "calc_scale_impact", sourcePort: "output", target: "calc_impact_score", targetPort: "input" },
        { id: "e10", source: "normalize_incident", sourcePort: "output", target: "build_impact_summary", targetPort: "input" },
        { id: "e11", source: "calc_impact_score", sourcePort: "output", target: "build_impact_summary", targetPort: "value" },
        { id: "e12", source: "ai_classifier", sourcePort: "severity", target: "route_switch", targetPort: "value" },
        { id: "e13", source: "normalize_incident", sourcePort: "output", target: "route_switch", targetPort: "data" },
        { id: "e14", source: "route_switch", sourcePort: "critical", target: "action_critical", targetPort: "input" },
        { id: "e15", source: "route_switch", sourcePort: "warning", target: "action_warning", targetPort: "input" },
        { id: "e16", source: "route_switch", sourcePort: "normal", target: "action_normal", targetPort: "input" },
        { id: "e17", source: "action_critical", sourcePort: "output", target: "merge_actions", targetPort: "input" },
        { id: "e18", source: "action_warning", sourcePort: "output", target: "merge_actions", targetPort: "input" },
        { id: "e19", source: "action_normal", sourcePort: "output", target: "merge_actions", targetPort: "input" },
        { id: "e20", source: "normalize_incident", sourcePort: "output", target: "assemble_final_report", targetPort: "input" },
        { id: "e21", source: "merge_actions", sourcePort: "output", target: "assemble_final_report", targetPort: "value" },
        { id: "e22", source: "assemble_final_report", sourcePort: "output", target: "ops_return", targetPort: "input" }
      ]
    }
  },
  {
    id: "ai_support_triage",
    name: "AI Support-Ticket Triage",
    description: "Ingests support tickets, normalizes customer data, classifies priority via AI, branches urgent vs standard tickets, and generates formatted responses",
    icon: Sparkles,
    color: "#EC4899",
    definition: {
      schemaVersion: 1,
      name: "AI Support-Ticket Triage",
      nodes: [
        {
          id: "trig_ticket",
          type: "trigger.manual",
          version: 1,
          name: "Inbound Support Ticket",
          position: { x: 80, y: 220 },
          config: {
            defaultPayload: {
              ticketId: "TCK-8092",
              customerName: "Sarah Chen",
              email: "sarah.chen@enterprise.io",
              issue: "Database connection pools exhausting rapidly on US-East prod cluster causing 504 timeouts",
              tier: "enterprise",
            },
          },
        },
        {
          id: "extract_ticket",
          type: "data.object",
          version: 1,
          name: "Normalize Ticket Data",
          position: { x: 340, y: 220 },
          config: {
            fields: [
              { key: "ticketId", fromInput: true },
              { key: "customerName", fromInput: true },
              { key: "email", fromInput: true },
              { key: "issue", fromInput: true },
              { key: "tier", fromInput: true },
            ],
          },
        },
        {
          id: "ai_classify",
          type: "ai.classify",
          version: 1,
          name: "AI Priority Classifier",
          position: { x: 620, y: 220 },
          config: {
            categories: ["urgent", "bug", "billing", "general"],
            instructions: "Classify infrastructure outages, timeouts, and severe database errors as urgent",
          },
        },
        {
          id: "priority_gate",
          type: "logic.condition",
          version: 1,
          name: "Is Priority Urgent?",
          position: { x: 900, y: 220 },
          config: {
            operator: "===",
            value: "urgent",
          },
        },
        {
          id: "urgent_escalation",
          type: "text.template",
          version: 1,
          name: "Urgent Pager Escalation",
          position: { x: 1200, y: 120 },
          config: {
            template: "🚨 CRITICAL ESCALATION: Ticket {{ticketId}} from {{customerName}} (Tier: {{tier}}) flagged as URGENT. Immediate on-call pager dispatched for: {{issue}}",
          },
        },
        {
          id: "standard_routing",
          type: "text.template",
          version: 1,
          name: "Standard Queue Router",
          position: { x: 1200, y: 340 },
          config: {
            template: "📋 STANDARD QUEUE: Ticket {{ticketId}} from {{customerName}} queued for standard business-hours response.",
          },
        },
        {
          id: "merge_response",
          type: "flow.merge",
          version: 1,
          name: "Merge Triage Outcome",
          position: { x: 1500, y: 220 },
          config: {
            mode: "first_available",
          },
        },
        {
          id: "triage_return",
          type: "output.return",
          version: 1,
          name: "Final Triage Result",
          position: { x: 1760, y: 220 },
          config: {},
        },
      ],
      edges: [
        {
          id: "edge_01",
          source: "trig_ticket",
          sourcePort: "output",
          target: "extract_ticket",
          targetPort: "input",
        },
        {
          id: "edge_02",
          source: "extract_ticket",
          sourcePort: "output",
          target: "ai_classify",
          targetPort: "text",
        },
        {
          id: "edge_03",
          source: "ai_classify",
          sourcePort: "output",
          target: "priority_gate",
          targetPort: "a",
        },
        {
          id: "edge_04",
          source: "extract_ticket",
          sourcePort: "output",
          target: "priority_gate",
          targetPort: "data",
        },
        {
          id: "edge_05",
          source: "priority_gate",
          sourcePort: "true",
          target: "urgent_escalation",
          targetPort: "input",
        },
        {
          id: "edge_06",
          source: "priority_gate",
          sourcePort: "false",
          target: "standard_routing",
          targetPort: "input",
        },
        {
          id: "edge_07",
          source: "urgent_escalation",
          sourcePort: "output",
          target: "merge_response",
          targetPort: "input",
        },
        {
          id: "edge_08",
          source: "standard_routing",
          sourcePort: "output",
          target: "merge_response",
          targetPort: "input",
        },
        {
          id: "edge_09",
          source: "merge_response",
          sourcePort: "output",
          target: "triage_return",
          targetPort: "input",
        },
      ],
    },
  },
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
          targetPort: "a",
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
          targetPort: "a",
        },
        {
          id: "edge_02",
          source: "trigger_01",
          sourcePort: "output",
          target: "multiply_01",
          targetPort: "a",
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
  {
    id: "dual_manual_trigger",
    name: "Dual Trigger Pipeline",
    description: "Two distinct manual triggers executing in parallel and converging into an Addition node",
    icon: Zap,
    color: "#E2703A",
    definition: {
      schemaVersion: 1,
      name: "Dual Trigger Pipeline",
      nodes: [
        {
          id: "trig_a",
          type: "trigger.manual",
          version: 1,
          name: "Trigger A (Input A)",
          position: { x: 100, y: 100 },
          config: { triggerKey: "inputA", defaultPayload: 15 },
        },
        {
          id: "trig_b",
          type: "trigger.manual",
          version: 1,
          name: "Trigger B (Input B)",
          position: { x: 100, y: 260 },
          config: { triggerKey: "inputB", defaultPayload: 35 },
        },
        {
          id: "add_join",
          type: "math.add",
          version: 1,
          name: "Combine (A + B)",
          position: { x: 420, y: 180 },
          config: {},
        },
        {
          id: "output_01",
          type: "output.return",
          version: 1,
          name: "Return Sum",
          position: { x: 720, y: 180 },
          config: {},
        },
      ],
      edges: [
        {
          id: "edge_01",
          source: "trig_a",
          sourcePort: "output",
          target: "add_join",
          targetPort: "a",
        },
        {
          id: "edge_02",
          source: "trig_b",
          sourcePort: "output",
          target: "add_join",
          targetPort: "b",
        },
        {
          id: "edge_03",
          source: "add_join",
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
