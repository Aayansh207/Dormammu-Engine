# Dormammu Engine (Webster Workflow Automation)

A production-grade, reliable visual workflow automation platform and DAG execution engine. Dormammu Engine enables users to construct graph workflows with interactive drag-and-drop nodes, save immutable versions in PostgreSQL, validate workflows across structural and graph integrity levels, and execute them deterministically using an in-process sequential DAG scheduler.

---

## 🚀 Key Highlights & Architecture

- **Canonical Workflow Standard**: Explicit, namespaced format featuring deterministic node instances, declared input/output ports, directed edges, visual editor positions, and schema-validated configuration.
- **Authoritative Node Catalogue in PostgreSQL**: Node definitions, port schemas, configuration constraints, and capability flags are persisted in PostgreSQL (`node_definitions`) and automatically synced with trusted execution handlers on startup.
- **4-Level Unified Validator**:
  1. *Level 1 (Structural)*: Schema version compatibility (`1`, `1.0`), non-empty unique IDs, object shapes.
  2. *Level 2 (Graph Integrity)*: Source/target existence, port existence, duplicate edges, self-loop rejection, and cycle detection (3-color DFS).
  3. *Level 3 (Configuration)*: Type-specific schema constraints (finite numbers, non-zero divisors, valid modes/paths).
  4. *Level 4 (Semantic)*: Required input connections, defaults fallback, and port type compatibility.
- **Deterministic O(V + E) Execution Planner**: Derives adjacency indexes, in-degrees, entry nodes, and terminal targets with reproducible ID tie-breaking.
- **Isolated Node Runtime Contract**: Handlers execute with resolved input values, safe scoped logging, abort signals, and configurable execution timeouts.
- **Sequential DAG Scheduler**: Manages dependency readiness, topological ordering, fail-fast cascading blocking of downstream nodes on failure, cancellation propagation, deadlock detection, and final output extraction.
- **Immutable Versioning & Durable Run History**:
  - `Workflow`: Identity, ownership, metadata.
  - `WorkflowVersion`: Immutable snapshot of definition JSON per version (`v1`, `v2`, ...).
  - `WorkflowRun`: Execution run tracking status (`RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`), inputs, and final output.
  - `TaskRun`: Granular per-node execution records storing attempt counts, start/finish timestamps, duration, resolved inputs, outputs, and errors.
- **Interactive Visual Canvas**: React + Vite frontend with pan/zoom viewport, dynamic SVG Bezier connector curves, interactive port handles, node inspector, validation flyout, and real-time execution result modal.

---

## 📦 Phase 1 Node Catalogue (20 Nodes)

| Node Type | Category | Inputs | Outputs | Config Schema | Description |
|-----------|----------|--------|---------|---------------|-------------|
| `trigger.manual` | `trigger` | `input`, `payload` | `output` | `defaultPayload` | Manual workflow entry point with payload ingestion |
| `data.input` | `trigger` | - | `output`, `value` | `key`, `defaultValue` | Ingests named property from trigger payload or defaults |
| `math.add` | `mathematical` | `input`, `a`, `b` | `output`, `result` | `addend` | Sums inputs or applies configured addend |
| `math.subtract` | `mathematical` | `input`, `a`, `b` | `output`, `result` | `subtrahend` | Calculates difference ($a - b$ or input - subtrahend) |
| `math.multiply` | `mathematical` | `input`, `a`, `b` | `output`, `result` | `factor` | Multiplies inputs or applies configured factor |
| `math.divide` | `mathematical` | `input`, `a`, `b` | `output`, `result` | `divisor` | Divides inputs with division-by-zero protection |
| `math.modulo` | `mathematical` | `input`, `a`, `b` | `output`, `result` | `divisor` | Remainder of division with zero-divisor checking |
| `math.power` | `mathematical` | `input`, `base`, `exponent` | `output`, `result` | `exponent` | Computes $base^{exponent}$ |
| `math.round` | `mathematical` | `input`, `value` | `output`, `result` | `precision`, `mode` | Rounds numbers (`round`, `floor`, `ceil`) |
| `math.abs` | `mathematical` | `input`, `value` | `output`, `result` | - | Computes absolute value ($\|x\|$) |
| `math.min` | `mathematical` | `input`, `a`, `b` | `output`, `result` | `compareValue` | Evaluates minimum of inputs or compareValue |
| `math.max` | `mathematical` | `input`, `a`, `b` | `output`, `result` | `compareValue` | Evaluates maximum of inputs or compareValue |
| `math.average` | `mathematical` | `input`, `a`, `b` | `output`, `result` | - | Computes arithmetic mean |
| `json.parse` | `json` | `input`, `text` | `output`, `data` | `defaultText` | Parses valid JSON strings with structured error handling |
| `json.get` | `json` | `input`, `object`, `path` | `output`, `value` | `path`, `defaultValue` | Extracts nested properties via dot/bracket path |
| `text.concat` | `text` | `input`, `a`, `b` | `output` | `separator`, `suffix` | Concatenates text strings with separator & suffix |
| `utility.uuid` | `utility` | - | `output`, `uuid` | - | Generates RFC 4122 Version 4 UUID |
| `utility.datetime` | `utility` | - | `output`, `timestamp` | `format` | Current timestamp in ISO, UTC, or epoch format |
| `output.log` | `output` | `input`, `message` | `output`, `logged` | `level` | Writes diagnostic logs and forwards input |
| `output.return` | `output` | `input`, `value` | `output`, `finalValue` | - | Captures and exposes the final workflow output |

> 📖 **Complete Node Reference & Workflow Creation Guide**: Read [`docs/NODE_REFERENCE_AND_WORKFLOW_GUIDE.md`](docs/NODE_REFERENCE_AND_WORKFLOW_GUIDE.md) for full port specifications, configuration parameters, execution rules, and step-by-step pipeline blueprints.

---

## 🛠️ Repository Structure

```
Dormammu-Engine/
├── backend/
│   ├── app.js                          # Express application configuration & CORS
│   ├── server.js                       # HTTP server & startup synchronization
│   ├── env.js                          # Validated environment configuration
│   ├── package.json                    # Backend dependencies & test scripts
│   ├── prisma/
│   │   ├── schema.prisma               # Prisma data models (Workflows, Runs, Nodes, Auth)
│   │   └── migrations/                 # Safe reversible PostgreSQL migrations
│   ├── src/
│   │   ├── config/db.js                # Neon PostgreSQL connection pool & Prisma adapter
│   │   ├── controllers/                # REST API controllers (Workflows, Nodes, Auth)
│   │   ├── services/                   # Business logic & database persistence services
│   │   ├── routes/                     # Express API routes
│   │   └── engine/                     # Core Webster Execution Engine
│   │       ├── contracts/              # Context, errors, and port type checking
│   │       ├── validator/              # 4-level workflow validation engine
│   │       ├── planner/                # O(V + E) deterministic execution planner
│   │       ├── runtime/                # Node runtime & handler invocation
│   │       ├── scheduler/              # Sequential DAG scheduler & failure orchestrator
│   │       └── registry/               # Authoritative node registry & trusted handlers
│   │           └── nodes/              # 20 complete node implementations
│   ├── test_workflow_engine.js         # Engine unit tests (all 20 nodes, validator, scheduler)
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
    │   │   ├── RunExecutionModal.jsx   # Execution runner & task breakdown viewer
    │   │   └── WorkflowList.jsx        # Workflow dashboard & management
    │   ├── services/api.js             # API client with token refresh & workflow endpoints
    │   └── types/workflow.d.ts         # TypeScript contracts matching backend definitions
    └── vite.config.js                  # Vite build & bundler configuration
```

---

## 🧪 Testing & Verification

The repository contains an automated test suite verifying node handlers, graph validation, topological DAG scheduling, failure cascading, and PostgreSQL persistence:

```bash
# Run backend test suites
cd backend
npm test
```

### Verified Test Results:
```
=======================================================
 Webster Engine Unit & Integration Test Suite
=======================================================
--- 1. Node Handler Unit Tests (All 20 Nodes) ---
  ✓ trigger.manual: extracts triggerData payload
  ✓ trigger.manual: falls back to defaultPayload when no triggerData
  ✓ data.input: extracts key from triggerData
  ✓ data.input: returns defaultValue if key is missing in triggerData
  ✓ math.add: calculates sum of a and b or input + addend
  ✓ math.subtract: calculates difference a - b or input - subtrahend
  ✓ math.multiply: multiplies values or applies factor
  ✓ math.divide: performs division and rejects division by zero
  ✓ math.modulo: computes remainder and rejects modulo by zero
  ✓ math.power: computes base ^ exponent
  ✓ math.round: handles precision and rounding modes (round, floor, ceil)
  ✓ math.abs: returns absolute value of positive and negative numbers
  ✓ math.min & math.max: correctly evaluate bounds
  ✓ math.average: computes mean of provided values
  ✓ json.parse: parses valid JSON and throws structured INVALID_JSON error for invalid JSON
  ✓ json.get: extracts nested properties with dot and bracket notation
  ✓ text.concat: combines strings with separator and suffix
  ✓ utility.uuid: generates valid RFC 4122 v4 UUID
  ✓ utility.datetime: returns timestamp and formatted string
  ✓ output.log: logs message safely and passes output through
  ✓ output.return: extracts final workflow return value

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

Results: 32 passed, 0 failed

=======================================================
 Webster Persistence, Versioning & API Integration Suite
=======================================================
--- 1. Node Metadata PostgreSQL Persistence ---
  ✓ PostgreSQL: seedNodeDefinitions upserts all 20 nodes into database
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

Results: 10 passed, 0 failed
```

---

## 🏃 Running Locally

### Backend Setup
```bash
cd backend
npm install
npx prisma migrate deploy
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5174` (or port configured in `.env`) to access the Webster visual canvas.