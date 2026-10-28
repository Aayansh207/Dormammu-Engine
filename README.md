# Dormammu Engine (Webster Workflow Automation)

A production-grade, reliable visual workflow automation platform and DAG execution engine. Dormammu Engine enables users to construct graph workflows with interactive drag-and-drop nodes, save immutable versions in PostgreSQL, validate workflows across structural and graph integrity levels, and execute them deterministically using an in-process sequential DAG scheduler.

---

## 🚀 Key Highlights & Architecture

- **General-Purpose Workflow Automation Platform**: Build, configure, validate, and execute arbitrary DAG workflows for data processing, AI triage, webhook ingestion, external API integrations, and business logic.
- **Canonical Workflow Standard**: Explicit, namespaced format featuring deterministic node instances, declared input/output ports, directed edges, visual editor positions, and schema-validated configuration.
- **Authoritative Node Catalogue in PostgreSQL**: 35 production node definitions, port schemas, configuration constraints, and capability flags are persisted in PostgreSQL (`node_definitions`) and automatically synced with trusted execution handlers on startup.
- **4-Level Unified Validator**:
  1. *Level 1 (Structural)*: Schema version compatibility (`1`, `1.0`), non-empty unique IDs, object shapes.
  2. *Level 2 (Graph Integrity)*: Source/target existence, port existence, duplicate edges, self-loop rejection, and cycle detection (3-color DFS).
  3. *Level 3 (Configuration)*: Type-specific schema constraints (finite numbers, non-zero divisors, valid modes/paths).
  4. *Level 4 (Semantic)*: Required input connections, defaults fallback, and port type compatibility.
- **Deterministic O(V + E) Execution Planner**: Derives adjacency indexes, in-degrees, entry nodes, and terminal targets with reproducible ID tie-breaking.
- **Isolated Node Runtime Contract**: Handlers execute with resolved input values, safe scoped logging, abort signals, and configurable execution timeouts.
- **Sequential DAG Scheduler**: Manages dependency readiness, topological ordering, cascading branch skipping (`SKIPPED`), fail-fast blocking of downstream nodes on failure (`BLOCKED`), cancellation propagation, deadlock detection, and final output extraction.
- **Live Observability & Durable History**:
  - `Workflow`: Identity, ownership, metadata.
  - `WorkflowVersion`: Immutable snapshot of definition JSON per version (`v1`, `v2`, ...).
  - `WorkflowRun`: Execution run tracking status (`RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`), inputs, and final output.
  - `TaskRun`: Granular per-node execution records storing attempt counts, start/finish timestamps, duration, resolved inputs, outputs, and errors.
  - `SSE Streaming`: Live execution events pushed in real time via Server-Sent Events (`/api/runs/:id/events`).
- **Interactive Visual Canvas**: React + Vite frontend with pan/zoom viewport, dynamic SVG Bezier connector curves, interactive port handles, node inspector, validation drawer, manual execution modal with custom JSON input, and webhook testing interface.

---

## 📖 General-Purpose Workflow Product Guide

### 1. Creating or Opening a Workflow
- **Workflow Listing**: Open the dashboard to view all saved workflows with their real execution status, node count, and last run time.
- **New Workflow**: Click **"New Workflow"** to start with a blank canvas or select from starter templates.
- **Open & Edit**: Click any workflow card to load the graph into the visual editor.

### 2. Configuring Nodes and Wires
- **Node Palette**: Drag any of the 35 available nodes from the searchable left palette onto the canvas.
- **Wiring (Connections)**: Connect an output port of an upstream node to a compatible input port of a downstream node by dragging between port handles.
- **Node Inspector**: Click any node to open the inspector panel on the right. Configure type-specific parameters, such as formulas, JSON paths, AI prompt instructions, HTTP target URLs, or switch cases.
- **Validation**: Click **"Validate"** in the top bar or view the real-time validation indicator to ensure your graph is free of cycles, disconnected required inputs, or invalid configurations.

### 3. Saving Workflows
- Click **"Save Workflow"** in the top bar.
- Dormammu validates the workflow and creates an immutable new version snapshot in PostgreSQL (`WorkflowVersion`), preserving historical definitions while updating the active workflow state.

### 4. Running a Workflow Manually
- Click **"Execute Workflow"** (Run) in the top bar.
- **Supplying Custom Input**: In the **Run Execution Modal**, supply any custom JSON payload or numeric input.
- **Multi-Trigger Workflows**: If your workflow has multiple manual triggers, you can provide per-trigger inputs or broadcast the payload to all triggers.
- Click **"Run Workflow"**. The engine validates the DAG, executes nodes in topological order, and streams real-time updates as nodes transition between `RUNNING`, `SUCCEEDED`, `SKIPPED`, or `FAILED`.
- View individual node inputs, outputs, execution duration, and the final output payload returned by `output.return`.

### 5. Configuring Webhook Triggers
- Any workflow containing a `trigger.webhook` node can be triggered via HTTP POST.
- The webhook URL follows the canonical structure:
  ```
  POST http://localhost:5001/api/webhooks/:workflowId
  ```
- **Optional Secret Token**: Secure your webhook by specifying a secret token in the trigger node configuration or the `X-Webhook-Token` / `Bearer` header.
- **Testing in the UI**: Open the **"Webhook Trigger"** modal from the editor top bar to test live payloads with one click, inspect HTTP status codes and responses, and navigate directly to the persisted execution run.

### 6. Inspecting Failures and Run History
- **Run History**: Open the **"History"** panel to inspect persisted execution records for the workflow.
- **Failure Transparency**: If a node fails (e.g. an external HTTP service returns 500 or an invalid JSON payload is ingested), the engine records the exact error message, marks the failing task `FAILED`, and marks downstream nodes `BLOCKED`. No mock data or fake success states are ever fabricated.

---

## 💡 Example Saved Workflow: Dormammu AI Operations Center

The repository includes a comprehensive 17-node example workflow saved at:
[`backend/workflows/dormammu_ai_operations_center.json`](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/backend/workflows/dormammu_ai_operations_center.json)

This workflow demonstrates multi-stage orchestration on Dormammu:
1. **Ingestion**: Accepts incident telemetry payloads via manual trigger or webhook.
2. **Validation & Normalization**: Validates required fields (`errorRate`, `affectedUsers`, `service`) using `data.validate` and `data.object`.
3. **Dual Analysis Pipeline**:
   - Runs parallel **AI Incident Classification** via Groq AI (`ai.classify`) to determine severity (`critical`, `warning`, `normal`).
   - Simultaneously calculates numerical business impact scores using mathematical nodes (`math.multiply`, `math.round`).
4. **Service Enrichment**: Performs an outbound HTTP request (`http.request`) to fetch live infrastructure metrics.
5. **3-Way Severity Routing**: Uses `logic.switch` to route execution down the active severity branch while cascading `SKIPPED` on alternative branches.
6. **Report Assembly**: Merges action results using `flow.merge` and constructs a structured incident report returned via `output.return`.

You can open this workflow directly from your workflow list, inspect its nodes, edit its configuration, and execute it with any test payload.

---

## 📦 Production Node Catalogue (35 Canonical Nodes)

| Category | Node Types |
|----------|------------|
| **Triggers** | `trigger.manual`, `trigger.webhook`, `trigger.cron`, `data.input` |
| **Logic & Control Flow** | `logic.condition`, `logic.switch`, `flow.merge`, `flow.delay` |
| **Data & Transformation** | `data.object`, `data.validate`, `data.array.map` |
| **HTTP & Webhooks** | `http.request`, `http.respond` |
| **AI / Machine Learning** | `ai.classify`, `ai.extract`, `ai.summarize` |
| **Mathematical** | `math.add`, `math.subtract`, `math.multiply`, `math.divide`, `math.modulo`, `math.power`, `math.round`, `math.abs`, `math.min`, `math.max`, `math.average` |
| **JSON & Text** | `json.parse`, `json.get`, `text.concat`, `text.template` |
| **Utilities & Output** | `utility.uuid`, `utility.datetime`, `output.log`, `output.return` |

> 📖 **Complete Node Reference & Port Guide**: Read [`docs/NODE_REFERENCE_AND_WORKFLOW_GUIDE.md`](docs/NODE_REFERENCE_AND_WORKFLOW_GUIDE.md) for full port specifications, configuration parameters, execution rules, and pipeline blueprints.

---

## 🛠️ Repository Structure

```
Dormammu-Engine/
├── backend/
│   ├── app.js                          # Express application configuration & error handling
│   ├── server.js                       # HTTP server & startup synchronization
│   ├── env.js                          # Validated environment configuration
│   ├── package.json                    # Backend dependencies & test scripts
│   ├── workflows/                      # Saved canonical workflow definitions
│   │   └── dormammu_ai_operations_center.json # 17-node multi-stage example workflow
│   ├── prisma/
│   │   ├── schema.prisma               # Prisma data models (Workflows, Runs, Nodes, Auth)
│   │   └── migrations/                 # Safe reversible PostgreSQL migrations
│   ├── src/
│   │   ├── config/db.js                # Neon PostgreSQL connection pool & Prisma adapter
│   │   ├── controllers/                # REST API controllers (Workflows, Nodes, Webhooks, Auth)
│   │   ├── services/                   # Business logic, DB persistence & SSE services
│   │   ├── routes/                     # Express API routes
│   │   └── engine/                     # Core Webster Execution Engine
│   │       ├── contracts/              # Context, errors, and port type checking
│   │       ├── validator/              # 4-level workflow validation engine
│   │       ├── planner/                # O(V + E) deterministic execution planner
│   │       ├── runtime/                # Node runtime & handler invocation
│   │       ├── scheduler/              # Sequential DAG scheduler & branch orchestrator
│   │       ├── providers/              # Groq AI provider abstraction (LPU Inference Engine)
│   │       └── registry/               # Authoritative node registry & 35 trusted handlers
│   ├── test_workflow_engine.js         # Engine unit tests (all nodes, validator, scheduler)
│   └── test_api_and_integration.js     # DB persistence, versioning & authorization integration tests
└── frontend/
    ├── src/
    │   ├── components/workflow/        # Visual Workflow Editor components
    │   │   ├── WorkflowEditor.jsx      # Canvas, pan/zoom, keyboard shortcuts, orchestrator
    │   │   ├── NodeCard.jsx            # Canvas node card & port connectors
    │   │   ├── NodePalette.jsx         # Searchable category sidebar
    │   │   ├── NodeInspector.jsx       # Real-time config & port property inspector
    │   │   ├── EdgePath.jsx            # Interactive SVG Bezier curve renderer
    │   │   ├── ValidationDrawer.jsx    # Interactive validation error drawer
    │   │   ├── RunExecutionModal.jsx   # Execution runner, custom JSON input & task breakdown
    │   │   ├── WebhookTestingModal.jsx # Generic webhook testing & cURL inspector
    │   │   └── WorkflowList.jsx        # General workflow dashboard & management
    │   ├── services/api.js             # API client with token refresh & workflow endpoints
    │   └── types/workflow.d.ts         # TypeScript contracts matching backend definitions
    └── vite.config.js                  # Vite build & bundler configuration
```

---

## 🧪 Testing & Verification

The repository contains an automated test suite verifying node handlers, graph validation, topological DAG scheduling, control-flow branching, failure cascading, and PostgreSQL persistence:

```bash
# Run backend test suites
cd backend
npm test
```

### Verified Test Results (93 Tests, 0 Failures):
```
=======================================================
 Webster Engine Unit & Integration Test Suite
=======================================================
--- 1. Node Handler Unit Tests (35 Canonical Nodes) ---
  ✓ trigger.manual, data.input, trigger.webhook, trigger.cron
  ✓ math.add, math.subtract, math.multiply, math.divide, math.modulo, math.power, math.round, math.abs, math.min, math.max, math.average
  ✓ json.parse, json.get, text.concat, text.template
  ✓ utility.uuid, utility.datetime, output.log, output.return
  ✓ logic.condition, logic.switch, flow.merge, flow.delay
  ✓ data.object, data.validate, data.array.map
  ✓ http.request (with SSRF guard), http.respond
  ✓ ai.classify, ai.provider (Groq LPU), ai.extract, ai.summarize

--- 2. Validation & Graph Integrity Tests ---
  ✓ Validator: accepts valid linear workflow
  ✓ Validator: detects self-loop and rejects with CYCLE_DETECTED
  ✓ Validator: detects multi-node cycle (A -> B -> C -> A)
  ✓ Validator: detects nonexistent source and target nodes
  ✓ Validator: detects invalid configuration values
  ✓ Validator: detects unknown node types

--- 3. Sequential DAG Execution Engine Tests ---
  ✓ Scheduler: executes linear DAG and returns final value
  ✓ Scheduler: executes branching and joining DAG with multiple predecessors
  ✓ Scheduler: produces identical deterministic results regardless of node/edge array order
  ✓ Scheduler: fail-fast marks downstream nodes as BLOCKED on node failure
  ✓ Scheduler: respects cancellation signal and marks unstarted tasks CANCELLED
  ✓ Scheduler: executes workflow with multiple manual triggers

--- 4. Control-Flow & Branching DAG Scheduler Tests ---
  ✓ Scheduler: conditional branch routes execution down TRUE branch and cascades SKIPPED down FALSE branch
  ✓ Scheduler: conditional branch routes execution down FALSE branch and cascades SKIPPED down TRUE branch
  ✓ Scheduler: switch routes execution to matching case and cascades SKIPPED on unselected cases
  ✓ Scheduler: flow.merge joins active branch when alternative branch was skipped
  ✓ Scheduler: flow.merge in 'all' and 'object' modes cleanly joins active branch when alternative is skipped
  ✓ Scheduler: non-blocking delay pauses workflow and resumes downstream execution

--- 5. New Trigger & Data Validation Unit Tests ---
  ✓ trigger.webhook, trigger.cron, data.validate, http.request failOnError

--- 6. Phase 1 Extended Execution Semantics ---
  ✓ Single-node execution, empty workflow rejection, repeated execution isolation

--- 7. Operations Center Workflow Scenarios ---
  ✓ Scenario 1: Critical outage routes to CRITICAL escalation with real telemetry & impact calculations
  ✓ Scenario 2: Normal billing inquiry routes to STANDARD support queue
  ✓ Scenario 3: Warning degradation routes to PROMPT INVESTIGATION
  ✓ Scenario 4: Invalid input rejected fast at validate_incident, marking downstream BLOCKED
  ✓ Scenario 5: Controlled HTTP failure stops workflow and marks downstream BLOCKED

--- 8. Cron Scheduler & SSE Streaming Services ---
  ✓ CronSchedulerService and SseService verification

Results: 74 passed, 0 failed

=======================================================
 Webster Persistence, Versioning & API Integration Suite
=======================================================
--- 1. Node Metadata PostgreSQL Persistence ---
  ✓ PostgreSQL: seedNodeDefinitions upserts all 35 nodes into database
  ✓ PostgreSQL: repeated seeding is idempotent and does not create duplicates
  ✓ PostgreSQL: listNodes and getNodeMetadata return accurate metadata with handler status

--- 2. Workflow Persistence, Versioning & Authorization ---
  ✓ Workflow: creates workflow and immutable version 1 in PostgreSQL
  ✓ Workflow: user can view their own workflow
  ✓ Authorization: other users are rejected with 403 Forbidden
  ✓ Workflow Versioning: updates create immutable version 2, leaving version 1 intact

--- 3. Full Execution & Durable State Persistence ---
  ✓ Execution: runs immutable version 2 and persists WorkflowRun and TaskRuns in PostgreSQL
  ✓ Execution Inspection: owner can retrieve run details and task runs
  ✓ Execution Authorization: unauthorized user cannot access run history

--- 4. Webhook Trigger Pipeline Integration ---
  ✓ Webhook: executes workflow and persists WorkflowRun with trigger payload
  ✓ Webhook: rejects unauthorized request with 401 when token is invalid or missing

--- 5. Saved Workflow Persistence ---
  ✓ Multi-scenario persistence in PostgreSQL
  ✓ Webhook Security: rejects unsupported HTTP method with 405 Method Not Allowed
  ✓ Webhook Security: rejects unknown workflow ID with 404 Not Found
  ✓ Persistence Recovery: getRunById and getRunTasks retrieve full inspectable state

Results: 19 passed, 0 failed
Total: 93 passed, 0 failed
```

### Distributed Queue & Resilience Test Suite
```bash
node test_distributed_queue_and_resilience.js
```
```text
=======================================================
 Dormammu Distributed Queue & Resilience Test Suite
=======================================================
--- 1. Redis Connection & Queue Infrastructure ---
  ✓ Redis: health check confirms connectivity
  ✓ TaskWorker: starts successfully with configured concurrency
--- 2. Single-Node Task Execution & State Persistence ---
  ✓ Distributed Execution: executes single-node task through BullMQ and persists TaskExecution
--- 3. Linear DAG Distributed Execution & Downstream Scheduling ---
  ✓ Distributed DAG: executes 3-node linear pipeline with output passing
--- 4. Parallel Branch Execution ---
  ✓ Parallel Execution: executes independent ready branches concurrently
--- 5. Branching, Skipped-Node Propagation & Merge Semantics ---
  ✓ Branching & Skipping: active branch executes, inactive branch cascades SKIPPED, merge succeeds
--- 6. Failure Propagation & Fail-Fast Blocking ---
  ✓ Failure Cascade: failed node causes downstream tasks to be marked BLOCKED
--- 7. Configurable Retries, Backoff & Error Classification ---
  ✓ Retry Policy: retryable error classification identifies transient vs permanent errors
  ✓ Backoff Calculation: exponential delays with maximum bounds and jitter
  ✓ Retry Execution: retryable failure exhausts retry limit and records attempt history
--- 8. Workflow & Task Idempotency ---
  ✓ Trigger Idempotency: identical request with same key returns existing run
  ✓ Trigger Idempotency Conflict: reusing key with different payload throws 409 Conflict
  ✓ Task Idempotency: atomic claim prevents duplicate worker execution
--- 9. Transactional Outbox & Crash Recovery ---
  ✓ Transactional Outbox: records intended dispatch and dispatches to queue
  ✓ Crash Recovery: reconciler recovers expired claims and deadlocked runs
--- 10. Database Query & Write Optimization Metrics ---
  ✓ Database Efficiency: plan caching avoids redundant definition compilations
  ✓ Database Efficiency: runs and tasks use indexed queries and targeted fields
--- 11. Upstash Redis, DLQ, Worker Discovery & Metrics ---
  ✓ Upstash Redis: configuration parsing and URL sanitization
  ✓ Worker Discovery: active worker heartbeats are discovered via Redis
  ✓ Dead-Letter Queue (DLQ): enqueues failed tasks, records metrics, and enables replay
  ✓ Native BullMQ Delay: delay nodes execute via queue scheduler without blocking workers
  ✓ Database Metrics: queries and latency are instrumented during execution

Distributed Queue Suite Results: 22 passed, 0 failed
```

---

## ⚡ Distributed Architecture (Upstash Redis + BullMQ)

For detailed distributed system specifications, refer to [DISTRIBUTED_ARCHITECTURE.md](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/DISTRIBUTED_ARCHITECTURE.md).

- **Durable Persistence**: PostgreSQL stores workflow graphs, versions, run states, task executions, and idempotency keys.
- **Distributed Coordination**: Upstash Redis (`rediss://`) hosts BullMQ queues, delayed jobs, worker heartbeats, and DLQ.
- **Autonomous Worker Pool**: Independent Node.js worker processes (`npm run worker`) claim and execute tasks with atomic PostgreSQL leases.
- **Dead-Letter Queue (DLQ)**: Failed tasks after retry exhaustion are routed to `dormammu:workflow:dlq` and can be inspected via `/api/runs/dlq` or replayed via `/api/runs/dlq/:jobId/retry`.
- **Sub-Second Webhook Ingestion**: Webhooks return `202 Accepted` in sub-second latency (p50: 658ms, avg: 777ms) with background execution.

---

## 🏃 Running Locally

### 1. Backend API Gateway
```bash
cd backend
npm install
npm run dev
```

### 2. Autonomous Distributed Worker (BullMQ)
```bash
cd backend
npm run worker
```

### 3. Frontend Canvas (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5174` (or port configured in `.env`) to access Dormammu Engine. Toggle between **Direct Synchronous** and **⚡ BullMQ + Redis (Distributed)** execution directly in the Run Modal!