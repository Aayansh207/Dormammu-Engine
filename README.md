# 🌌 Dormammu Engine (NexFlow Workflow Automation)

[![Node.js](https://img.shields.io/badge/Node.js-v20+-68a063?style=flat-square&logo=node.js)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.3-61dafb?style=flat-square&logo=react)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791?style=flat-square&logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.10-2d3748?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Yjs CRDT](https://img.shields.io/badge/Real--Time-Yjs%20CRDTs-orange?style=flat-square)](https://yjs.dev/)
[![Groq AI](https://img.shields.io/badge/AI%20Inference-Groq%20LLaMA%203.3-f55036?style=flat-square)](https://groq.com/)
[![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)](LICENSE)

A production-grade, highly reliable visual workflow automation platform and DAG execution engine. Dormammu Engine (NexFlow) enables teams to build complex Directed Acyclic Graph (DAG) workflows on an interactive canvas, collaborate in real time with multi-user CRDT synchronization, manage team workspaces with role-based permissions, persist immutable version snapshots in PostgreSQL, and execute workflows deterministically with durable reporting and live SSE telemetry.

---

## 📑 Table of Contents

1. [Key Highlights & Architecture](#-key-highlights--architecture)
2. [Real-Time Collaboration & Workspaces](#-real-time-collaboration--workspaces)
3. [Durable Execution Reports & Observability](#-durable-execution-reports--observability)
4. [Autonomous Triggers & Cron Scheduling](#-autonomous-triggers--cron-scheduling)
5. [The 4-Tier Workflow Validator](#-the-4-tier-workflow-validator)
6. [Production Node Catalogue (35 Canonical Nodes)](#-production-node-catalogue-35-canonical-nodes)
7. [Flagship Workflow: AI Operations Center](#-flagship-workflow-ai-operations-center)
8. [Interactive Visual Canvas & UI Suite](#-interactive-visual-canvas--ui-suite)
9. [REST & WebSocket API Reference](#-rest--websocket-api-reference)
10. [Repository Structure](#-repository-structure)
11. [Testing & Verification Suites](#-testing--verification-suites)
12. [Running Locally & Environment Setup](#-running-locally--environment-setup)

---

## 🚀 Key Highlights & Architecture

- **Deterministic O(V + E) Execution Planner**: Derives adjacency indexes, in-degrees, entry nodes, and terminal targets with reproducible ID tie-breaking and Kahn's topological sort.
- **Real-Time Multi-User Collaboration**: Built on Yjs CRDTs over WebSockets (`ws`), enabling concurrent graph editing, live remote cursor tracking, active node selection highlights, and presence awareness.
- **Collaborative Workspaces & RBAC**: Organize workflows into workspaces with granular Role-Based Access Control (`OWNER`, `EDITOR`, `VIEWER`), email-based team invitations, and token verification.
- **Immutable Versioning & Safe Rollback**: Every workflow save creates an immutable version snapshot (`WorkflowVersion`). Easily inspect past versions or perform a safe one-click rollback to create a new version while preserving complete history.
- **Durable JSON Execution Reports**: High-performance execution trace storage. Complete run telemetry, resolved inputs/outputs, node durations, and failure trees are stored directly in `WorkflowRun.report`, avoiding table bloating from millions of isolated row inserts.
- **Branch-Aware Control Flow**: Control-flow nodes (`logic.condition`, `logic.switch`) activate only selected paths while cascading `SKIPPED` statuses down unselected branches without causing graph deadlocks.
- **Native Groq AI LPU Integration**: High-speed AI inference for classification (`ai.classify`), entity extraction (`ai.extract`), and summarization (`ai.summarize`) powered by `llama-3.3-70b-versatile` with transparent offline mock simulation fallbacks.
- **Enterprise Security & SSRF Protection**: Outbound HTTP requests enforce RFC-compliant private CIDR blocking, cloud metadata IP guards (AWS/GCP/Azure 169.254.169.254), hop-by-hop redirect verification, and payload size limits.
- **Authoritative Node Catalogue in PostgreSQL**: 35 production node definitions, port schemas, configuration constraints, and capability flags are synchronized into PostgreSQL (`node_definitions`) on server bootstrap.
- **Multi-Channel Triggers**: Trigger workflows via manual execution modal, HTTP webhooks (synchronous or asynchronous `202 Accepted`), or background interval schedules (`node-cron`).

---

## 👥 Real-Time Collaboration & Workspaces

Dormammu Engine features enterprise-grade real-time collaboration:

### 1. Yjs CRDT Synchronization
- Connected editors share a real-time Yjs document synchronized over WebSockets (`/ws/collaboration`).
- Changes to node positions, configurations, wire connections, and viewport states merge automatically without merge conflicts or data loss.
- **Awareness & Presence**: Collaborators see each other's custom color-coded cursors, user names, and selected nodes in real time.

### 2. Role-Based Access Control (RBAC)
Workspaces support three distinct permission levels:

| Capability | OWNER | EDITOR | VIEWER |
| :--- | :---: | :---: | :---: |
| View workflows and execution reports | ✅ | ✅ | ✅ |
| Real-time canvas inspection | ✅ | ✅ | ✅ (Read-Only) |
| Edit workflow graph & configurations | ✅ | ✅ | ❌ |
| Execute workflows manually / trigger runs | ✅ | ✅ | ❌ |
| Roll back workflow versions | ✅ | ✅ | ❌ |
| Invite & remove team members | ✅ | ❌ | ❌ |
| Delete workspace & workflows | ✅ | ❌ | ❌ |

### 3. Team Member Invitations
- Workspace owners can invite members via email with assigned roles (`EDITOR` or `VIEWER`).
- Invitations generate cryptographically signed tokens delivered via email (`mail.service.js` with Nodemailer / Mailjet).
- Invitees can accept or decline invitations directly from the web interface.

---

## 📊 Durable Execution Reports & Observability

Workflow execution records are architected for enterprise durability and rapid query performance:

- **Durable Report Schema**: Instead of writing separate database rows for each individual task, the scheduler consolidates the entire execution graph into a single structured JSON report persisted in `WorkflowRun.report`.
- **Granular Per-Node Telemetry**:
  - `status`: `PENDING`, `RUNNING`, `SUCCEEDED`, `SKIPPED`, `FAILED`, or `BLOCKED`.
  - `timing`: `startedAt`, `finishedAt`, and millisecond execution `durationMs`.
  - `data`: Exact resolved inputs and emitted outputs per port.
  - `error`: Structured error code, message, and stack trace if a failure occurs.
- **Execution Reports Hub (`ExecutionReportsList` & `ExecutionReportDetail`)**:
  - Filter and search past runs across all workflows by status, trigger type, or date range.
  - Visual DAG replay highlighting active execution paths, skipped branches, and blocked failure cascades.
  - JSON inspector for deep payload inspection with one-click clipboard copying.
- **Live SSE Streaming**: Long-running executions stream real-time node transitions directly to the browser via Server-Sent Events (`/api/runs/:id/events`).

---

## 🕒 Autonomous Triggers & Cron Scheduling

Dormammu Engine includes an in-process, lifecycle-aware scheduler:

- **Server-Managed Cron Lifecycle**: The `CronSchedulerService` starts alongside Express, loads active workflow interval schedules from PostgreSQL on startup, and dynamically manages cron timers.
- **Interval Schedules & Webhooks**:
  - Run workflows automatically every minute, hour, day, or on custom cron expressions (`*/5 * * * *`).
  - Webhooks support both synchronous execution (returning final workflow output) and asynchronous ingestion (`202 Accepted` returning a report tracking URL).
- **Auto Incident Trigger Modal (`AutoIncidentTriggerModal.jsx`)**:
  - Built-in simulation tool for testing workflow resilience.
  - Inject preconfigured incident scenarios (e.g. Critical Outage, Latency Spike, Invalid Telemetry).
  - Simulate periodic cron sweeps and inspect automated recovery workflows in real time.

---

## 🛡️ The 4-Tier Workflow Validator

Before execution or version snapshotting, workflows undergo rigorous 4-tier validation:

```
┌─────────────────────────────────────────────────────────────────┐
│ Level 1: Structural Validation                                  │
│ - Schema version compatibility ('1.0', 1)                       │
│ - Non-empty unique node IDs, valid node types                   │
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Level 2: Graph Integrity Validation                             │
│ - Source and target node existence in graph                     │
│ - Port existence on declared node definitions                   │
│ - Duplicate wire rejection & self-loop prevention               │
│ - Zero-cycle guarantee via 3-color DFS cycle detection           │
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Level 3: Configuration Schema Validation                        │
│ - Node-specific schema constraints                              │
│ - Finite numbers, non-zero divisors, regex patterns             │
│ - Valid HTTP URLs, methods, headers, and timeout bounds         │
└────────────────┬────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Level 4: Semantic Validation                                    │
│ - Required input port connections or fallback defaults          │
│ - Port type compatibility checking (e.g., number -> number)     │
│ - Multi-wire input port enforcement (allowMultiple flags)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Production Node Catalogue (35 Canonical Nodes)

All 35 production node definitions are persisted in PostgreSQL and synchronized on startup:

| Category | Node Types | Purpose & Capabilities |
| :--- | :--- | :--- |
| **Triggers** | `trigger.manual`<br>`trigger.webhook`<br>`trigger.cron`<br>`data.input` | Ingest user payloads, HTTP webhook calls, cron timers, and structured pipeline inputs. |
| **Logic & Control Flow** | `logic.condition`<br>`logic.switch`<br>`flow.merge`<br>`flow.delay` | Binary if/else routing, multi-case matching, branch joining (`first_available`, `all`, `coalesce`), and non-blocking timers. |
| **Data & Transformation** | `data.object`<br>`data.validate`<br>`data.array.map` | JSON schema validation, nested object builder (with prototype pollution guards), and array item transformations. |
| **HTTP & Webhooks** | `http.request`<br>`http.respond` | Outbound HTTP requests with SSRF guards and custom webhook responses. |
| **AI / Machine Learning** | `ai.classify`<br>`ai.extract`<br>`ai.summarize` | Zero-shot intent classification, entity extraction, and document summarization powered by Groq LLaMA 3.3. |
| **Mathematical** | `math.add`<br>`math.subtract`<br>`math.multiply`<br>`math.divide`<br>`math.modulo`<br>`math.power`<br>`math.round`<br>`math.abs`<br>`math.min`<br>`math.max`<br>`math.average` | Deterministic numerical computing, financial impact formulas, precision rounding, and division-by-zero safeguards. |
| **JSON & Text** | `json.parse`<br>`json.get`<br>`text.concat`<br>`text.template` | Safe JSON parsing, dot/bracket object queries, string templating with variable substitution (`{{var}}`). |
| **Utilities & Output** | `utility.uuid`<br>`utility.datetime`<br>`output.log`<br>`output.return` | RFC 4122 v4 UUIDs, ISO timestamps, safe scoped logging, and terminal workflow output return. |

> 📖 **Full Specifications**: Refer to [`docs/NODE_REFERENCE_AND_WORKFLOW_GUIDE.md`](docs/NODE_REFERENCE_AND_WORKFLOW_GUIDE.md) for full port contracts, input schemas, and configuration parameters.

---

## 💡 Flagship Workflow: AI Operations Center

The repository includes a production-grade 17-node incident triage workflow located at:
[`backend/workflows/dormammu_ai_operations_center.json`](backend/workflows/dormammu_ai_operations_center.json)

```
           [trigger.manual / trigger.webhook]
                           │
                           ▼
                  [data.validate] (Incident Schema Guard)
                           │
                           ▼
                  [data.object] (Normalized Incident)
                     │           │
        ┌────────────┘           └────────────┐
        ▼                                     ▼
[ai.classify] (Groq LLaMA 3.3)         [math.multiply] (affectedUsers * errorRate)
        │                                     │
        ▼                                     ▼
[logic.switch] (critical/warning/normal) [math.round] (Impact Score)
   │        │         │                       │
   ▼        ▼         ▼                       │
[Crit]   [Warn]    [Norm]                     │
   │        │         │                       │
   └────────┼─────────┘                       │
            ▼                                 │
      [flow.merge] (Active Action)            │
            │                                 │
            └───────────────┬─────────────────┘
                            ▼
                  [http.request] (Fetch Live Telemetry)
                            │
                            ▼
                  [data.object] (Consolidated Report)
                            │
                            ▼
                  [output.return] (Final Incident Payload)
```

### Operational Capabilities:
1. **Payload Ingestion**: Accepts production incident alerts via manual triggers or authenticated webhooks.
2. **Schema Validation**: Enforces numerical bounds on `errorRate` ($0 \le r \le 1.0$), required service names, and non-empty ticket identifiers.
3. **Dual Pipeline Execution**: Concurrently evaluates AI severity classification while computing exact numerical business impact scores.
4. **Dynamic 3-Way Branch Routing**: Directs execution down the active severity path while cleanly cascading `SKIPPED` statuses down alternative paths.
5. **Infrastructure Telemetry Enrichment**: Queries external monitoring endpoints for live latency and connection pool metrics.
6. **Structured Report Assembly**: Produces an actionable incident response plan returned via `output.return`.

---

## 🖥️ Interactive Visual Canvas & UI Suite

Built with **React 19** and **Vite**, the frontend delivers a responsive, desktop-class experience:

- **Infinite Canvas & Viewport**: Smooth panning, zoom-to-fit, grid snapping, and dynamic SVG Bezier connector curves (`EdgePath.jsx`) with live state coloring.
- **Node Inspector Drawer (`NodeInspector.jsx`)**: Contextual property editor for configuring node parameters, switch cases, AI prompts, and validation schemas.
- **Version History Drawer (`VersionHistoryDrawer.jsx`)**: Visual list of all immutable version snapshots with one-click restore and rollback capabilities.
- **Past Runs Drawer (`PastRunsDrawer.jsx`)**: Quick slide-out drawer inside the editor displaying recent workflow runs, durations, and statuses.
- **Execution Run Modal (`RunExecutionModal.jsx`)**: Interactive runner supporting custom test payloads, sample scenarios, multi-trigger broadcasting, and live step-by-step trace inspection.
- **Webhook Testing Modal (`WebhookTestingModal.jsx`)**: Test live HTTP webhook endpoints with custom headers, sample bodies, and pre-formatted `curl` commands.
- **Workspace Management Modal (`WorkspaceModal.jsx`)**: Create workspaces, invite team members by email, manage role permissions, and track pending invitations.
- **QuickAdd Popover (`QuickAddPopover.jsx`)**: Rapid node creation keyboard shortcut directly at canvas cursor coordinates.
- **Automatic Layout (`autoLayout.js`)**: Instant one-click topological DAG rearrangement.

---

## 🔌 REST & WebSocket API Reference

### Workflows & Versions
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/workflows` | List workflows in active workspace or owned by user |
| `POST` | `/api/workflows` | Create a new workflow |
| `GET` | `/api/workflows/:id` | Get workflow definition and active version |
| `PUT` | `/api/workflows/:id` | Update workflow (saves new immutable `WorkflowVersion`) |
| `DELETE` | `/api/workflows/:id` | Delete workflow (Owner only) |
| `GET` | `/api/workflows/:id/versions` | List all historical versions for workflow |
| `POST` | `/api/workflows/:id/versions/:v/rollback` | Roll back to version `v` (appends new version) |

### Execution & Observability
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/workflows/:id/run` | Execute workflow manually with optional `triggerData` |
| `GET` | `/api/workflows/:id/runs` | List execution runs for a workflow |
| `GET` | `/api/runs/:id` | Get full execution details and durable report |
| `GET` | `/api/runs/:id/events` | Server-Sent Events (SSE) live execution stream |

### Webhooks
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/webhooks/:workflowId` | Trigger workflow via HTTP webhook (sync or async `202`) |

### Workspaces & Collaboration
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/workspaces` | List accessible workspaces |
| `POST` | `/api/workspaces` | Create a new workspace |
| `GET` | `/api/workspaces/:id` | Get workspace details and members list |
| `POST` | `/api/workspaces/:id/invitations` | Invite a member by email (`EDITOR` or `VIEWER`) |
| `POST` | `/api/workspaces/invitations/:token/accept` | Accept workspace invitation |
| `DELETE` | `/api/workspaces/:id/members/:userId` | Remove member from workspace (Owner only) |
| `WS` | `/ws/collaboration?workflowId=:id&token=:jwt` | Real-time Yjs CRDT WebSocket synchronization |

---

## 🗂️ Repository Structure

```
Dormammu-Engine/
├── backend/
│   ├── app.js                          # Express app configuration & middleware
│   ├── server.js                       # HTTP server, WebSocket upgrade & cron bootstrap
│   ├── env.js                          # Validated environment configuration
│   ├── package.json                    # Backend dependencies & test scripts
│   ├── workflows/                      # Preconfigured canonical workflows
│   │   ├── dormammu_ai_operations_center.json # 17-node flagship operations workflow
│   │   └── cron_health_check_workflow.json    # Periodic system health check workflow
│   ├── prisma/
│   │   ├── schema.prisma               # Prisma data models (Workspaces, Users, Workflows, Runs)
│   │   └── migrations/                 # Safe reversible PostgreSQL migrations
│   ├── src/
│   │   ├── collaboration/              # Real-time Yjs CRDT WebSocket server
│   │   │   └── yjs.server.js           # Room management, awareness, and role guards
│   │   ├── config/                     # PostgreSQL connection pool & Prisma client
│   │   ├── controllers/                # Request handlers (Workflows, Workspaces, Webhooks, Auth)
│   │   ├── middleware/                 # JWT auth, RBAC permissions, and session validation
│   │   ├── routes/                     # Express API routes
│   │   ├── services/                   # Business logic (Workflow, Workspace, Cron, SSE, Mail)
│   │   └── engine/                     # Core Webster Execution Engine
│   │       ├── contracts/              # Context, structured errors, and port type definitions
│   │       ├── validator/              # 4-level DAG validation engine
│   │       ├── planner/                # O(V + E) deterministic execution planner
│   │       ├── runtime/                # Node runtime & input/output resolution
│   │       ├── scheduler/              # Sequential DAG scheduler & branch pruning
│   │       ├── providers/              # Groq AI provider abstraction (LPU Inference Engine)
│   │       └── registry/               # Authoritative registry with 35 production node handlers
│   ├── test_workflow_engine.js         # Engine unit tests (all nodes, validator, scheduler)
│   ├── test_api_and_integration.js     # Persistence, versioning & webhook integration tests
│   └── test_collaboration_and_roles.js # Real-time Yjs CRDT, Workspaces & RBAC test suite
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx              # Navigation bar, workspace switcher, and user menu
│   │   │   ├── Hero.jsx                # Landing page hero section
│   │   │   └── workflow/               # Visual Workflow Canvas & Editor components
│   │   │       ├── WorkflowEditor.jsx  # Main canvas, Yjs CRDT sync, and keyboard shortcuts
│   │   │       ├── NodeCard.jsx        # Canvas node card with port connectors & presence
│   │   │       ├── NodePalette.jsx     # Searchable 35-node categorized sidebar
│   │   │       ├── NodeInspector.jsx   # Real-time configuration & port property inspector
│   │   │       ├── EdgePath.jsx        # Dynamic SVG Bezier curves with glowing execution states
│   │   │       ├── ValidationDrawer.jsx# Real-time graph validation drawer
│   │   │       ├── RunExecutionModal.jsx# Manual run runner, custom JSON input & live trace
│   │   │       ├── WebhookTestingModal.jsx # Webhook test tool with curl generator
│   │   │       ├── AutoIncidentTriggerModal.jsx # Chaos simulator & cron trigger panel
│   │   │       ├── ExecutionReportsList.jsx  # Searchable historical runs list
│   │   │       ├── ExecutionReportDetail.jsx # Deep execution report telemetry viewer
│   │   │       ├── VersionHistoryDrawer.jsx  # Immutable versions & rollback manager
│   │   │       ├── PastRunsDrawer.jsx        # Quick slide-out run history
│   │   │       ├── WorkspaceModal.jsx        # Workspace settings & team invitations
│   │   │       └── WorkflowList.jsx    # Workflow dashboard & starter templates
│   │   ├── services/api.js             # API client with token refresh & endpoint helpers
│   │   ├── App.jsx                     # Application root routing & view coordinator
│   │   └── main.jsx                    # Vite React application entrypoint
│   └── vite.config.js                  # Vite configuration & dev proxy
│
└── docs/
    ├── DORMAMMU_ENGINE_KNOWLEDGE_BOOK.md          # Complete project architectural guide
    ├── FULL_ARCHITECTURE_AND_CODEBASE_REFERENCE.md# Deep dive codebase reference
    └── NODE_REFERENCE_AND_WORKFLOW_GUIDE.md       # Comprehensive 35-node reference manual
```

---

## 🧪 Testing & Verification Suites

The repository contains automated test suites verifying node handlers, graph validation, topological DAG scheduling, control-flow branching, PostgreSQL persistence, and real-time collaboration:

### 1. Run the Test Suites

```bash
cd backend

# Run Engine Unit & Scheduling Tests
node test_workflow_engine.js

# Run PostgreSQL Persistence, Versioning & Webhook Tests
node test_api_and_integration.js

# Run Real-Time Yjs Collaboration, Workspaces & RBAC Tests
node test_collaboration_and_roles.js
```

### Verified Test Highlights:
- **Engine Tests (`test_workflow_engine.js`)**:
  - All 35 canonical node handlers (math, logic, AI, JSON, HTTP, utilities).
  - Graph integrity: detects self-loops, multi-node cycles, and invalid port configurations.
  - Sequential DAG scheduling, topological ordering, branch skipping (`SKIPPED`), and failure blocking (`BLOCKED`).
  - Cron scheduler and SSE live streaming services.
- **Persistence & API Tests (`test_api_and_integration.js`)**:
  - PostgreSQL node catalogue seeding and idempotent upserts.
  - Immutable versioning snapshots and authorization boundaries.
  - Durable execution report persistence in `WorkflowRun.report`.
  - Synchronous and asynchronous (`202 Accepted`) webhook pipelines.
- **Real-Time Collaboration Tests (`test_collaboration_and_roles.js`)**:
  - 25 automated end-to-end tests passing with zero failures.
  - Workspace creation, email invitations, and token acceptance flows.
  - RBAC verification across `OWNER`, `EDITOR`, and `VIEWER` roles.
  - Read-only write blocking for Viewers (cannot update, delete, execute, or rollback).
  - Safe version rollbacks (restoring Version 1 creates Version 3 preserving complete history).
  - Yjs WebSocket token verification and member revocation enforcement.

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

## 🏃 Running Locally & Environment Setup

### 1. Prerequisites
- **Node.js**: `v20.0.0` or higher
- **PostgreSQL**: Local instance or hosted Neon PostgreSQL database
- **Redis**: Local Redis or cloud Upstash Redis instance for BullMQ distributed execution
- **Groq API Key**: Optional for live AI tasks (offline mock simulation is automatically enabled when unset)

### 2. Backend Configuration
Create a `.env` file in `backend/` based on `backend/.env.example`:

```env
PORT=5001
NODE_ENV=development

# PostgreSQL connection strings
DATABASE_URL="postgresql://postgres:password@localhost:5432/dormammu?sslmode=disable"
DIRECT_URL="postgresql://postgres:password@localhost:5432/dormammu?sslmode=disable"

# Redis & BullMQ
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
REDIS_URL="redis://localhost:6379"

# JWT Secrets & Security
JWT_ACCESS_SECRET="your-super-secret-jwt-access-key-min-32-chars"
JWT_ACCESS_EXPIRATION="15m"
REFRESH_TOKEN_EXPIRATION_DAYS=7
EMAIL_VERIFICATION_EXPIRATION_HOURS=24
REQUIRE_EMAIL_VERIFICATION=false

# URLs
FRONTEND_URL="http://localhost:5174"
BACKEND_URL="http://localhost:5001"

# Optional Groq AI Key (LPU Inference)
GROQ_API_KEY=""

# Security Policies
ALLOW_PRIVATE_NETWORK_REQUESTS=true
ALLOW_OFFLINE_MOCK=true
```

### 3. Initialize Database & Start Backend API Gateway
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### 4. Autonomous Distributed Worker (BullMQ)
```bash
cd backend
npm run worker
```

### 5. Start Frontend Canvas (React + Vite)
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5174` (or port configured in `.env`) to access Dormammu Engine. Toggle between **Direct Synchronous** and **⚡ BullMQ + Redis (Distributed)** execution directly in the Run Modal!
