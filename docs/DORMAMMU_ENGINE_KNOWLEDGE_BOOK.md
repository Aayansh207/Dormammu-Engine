# 🌌 Dormammu Engine: Complete Project Knowledge Book & System Bible

> **Dormammu Engine (Project Webster)** is an event-driven, distributed Directed Acyclic Graph (DAG) workflow automation and orchestration engine built with multi-tenant session security, an extensible 36-node execution registry, Groq LLaMA 3.3 AI intelligence, and a visual React 19 graph designer.

---

## 📑 Table of Contents
1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
2. [Database Schema & Entity Relationship Model](#2-database-schema--entity-relationship-model)
3. [DAG Workflow Execution Engine Anatomy](#3-dag-workflow-execution-engine-anatomy)
4. [Authoritative 36-Node Registry Directory](#4-authoritative-36-node-registry-directory)
5. [AI Integration & Groq LLM Runtime](#5-ai-integration--groq-llm-runtime)
6. [Triggers, Webhooks, SSE & Cron Infrastructure](#6-triggers-webhooks-sse--cron-infrastructure)
7. [Authentication, Security & Session Management](#7-authentication-security--session-management)
8. [Backend Services & REST API Specification](#8-backend-services--rest-api-specification)
9. [Frontend Architecture & Visual Workflow Editor](#9-frontend-architecture--visual-workflow-editor)
10. [Autonomous AI Operations Center Implementation](#10-autonomous-ai-operations-center-implementation)
11. [Testing Suites, Validation Matrices & Verification](#11-testing-suites-validation-matrices--verification)
12. [Environment Configuration & Deployment Topology](#12-environment-configuration--deployment-topology)

---

## 1. Executive Summary & System Architecture

### 1.1 High-Level Vision
Dormammu Engine delivers enterprisegrade workflow automation inspired by systems like n8n and Temporal, engineered with mathematical graph guarantees:
- **Zero Cycles Guarantee**: Kahn's Topological Sorting algorithm and graph DFS cycle detection enforce strictly acyclic graphs.
- **Port Contract Type Safety**: Strict port-level schema validations (`any`, `string`, `number`, `boolean`, `object`, `array`) prevent runtime edge errors.
- **Durable Execution Reports**: Every workflow execution persists its complete runtime trace, inputs, outputs, timestamps, and AI metrics as JSON in PostgreSQL.
- **Real-Time Telemetry**: Execution states stream live to clients via Server-Sent Events (SSE).

### 1.2 Architectural Block Diagram

```mermaid
graph TB
    subgraph Client ["Client Layer (React 19 + Vite)"]
        UI[Visual Canvas Editor]
        Palette[36-Node Palette]
        Inspector[Node Inspector]
        ReportsUI[Execution Reports & Telemetry]
    end

    subgraph Gateway ["API Gateway & Security Layer (Express 4.21)"]
        AuthMid[JWT & Cryptographic Auth]
        SSRFMid[SSRF Validator & DNS Guard]
        Router[REST / Webhook / SSE Router]
    end

    subgraph Engine ["Webster DAG Engine"]
        Validator[4-Tier Workflow Validator]
        Planner[Topological Execution Planner]
        Scheduler[In-Process DAG Scheduler]
        Runtime[Node Execution Runtime]
        Registry[36-Node Registry]
        AIProvider[Groq LLaMA 3.3 Provider]
    end

    subgraph Storage ["Persistence & Infrastructure"]
        Postgres[(PostgreSQL 15+ via Prisma)]
        Redis[(Redis Cache & Session Store)]
        SSEPubSub[SSE Event Broadcaster]
        CronSvc[node-cron Scheduler]
    end

    UI --> Router
    Router --> AuthMid
    Router --> SSRFMid
    AuthMid --> Engine
    Validator --> Planner
    Planner --> Scheduler
    Scheduler --> Runtime
    Runtime --> Registry
    Registry --> AIProvider
    Runtime --> Postgres
    Scheduler --> SSEPubSub
    SSEPubSub --> ReportsUI
    CronSvc --> Scheduler
```

---

## 2. Database Schema & Entity Relationship Model

The storage engine relies on **PostgreSQL** managed through **Prisma ORM**.

```mermaid
erDiagram
    User ||--o{ Session : "has many"
    User ||--o{ EmailVerificationToken : "has many"
    User ||--o{ LoginHistory : "has many"
    User ||--o{ Workflow : "owns"
    Workflow ||--o{ WorkflowVersion : "versions"
    WorkflowVersion ||--o{ WorkflowRun : "executes"
    WorkflowRun ||--o{ TaskRun : "records"

    User {
        string id PK
        string email UK
        string name
        string passwordHash
        string googleId UK
        string profilePhoto
        string role
        boolean emailVerified
        datetime createdAt
        datetime updatedAt
    }

    Workflow {
        string id PK
        string ownerId FK
        string name
        string description
        datetime createdAt
        datetime updatedAt
    }

    WorkflowVersion {
        string id PK
        string workflowId FK
        int version
        string schemaVersion
        json definitionJson
        datetime createdAt
    }

    WorkflowRun {
        string id PK
        string workflowId
        string workflowVersionId FK
        string status
        string triggerType
        int durationMs
        json input
        json output
        json error
        json report
        datetime startedAt
        datetime finishedAt
    }

    TaskRun {
        string id PK
        string workflowRunId FK
        string nodeId
        string status
        int attempts
        json input
        json output
        json error
        datetime startedAt
        datetime finishedAt
    }

    NodeDefinition {
        string id PK
        string type UK
        int version UK
        string label
        string category
        json inputs
        json outputs
        json configSchema
        json capabilities
        boolean isAvailable
    }
```

---

## 3. DAG Workflow Execution Engine Anatomy

### 3.1 4-Tier Validation Standard
Before any workflow can be saved or executed, it passes through [workflow.validator.js](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/backend/src/engine/validator/workflow.validator.js):
1. **Structural Validation**: Ensures required top-level keys (`name`, `nodes`, `edges`), unique node IDs, and non-empty graph elements.
2. **Graph Cycle Detection**: Uses Kahn's Topological Sort algorithm ($O(V + E)$). Any residual in-degrees trigger a `CYCLE_DETECTED` error including the exact cycle path.
3. **Node Configuration Validation**: Validates each node's `config` against its authoritative `configSchema` defined in the node registry.
4. **Port Contract & Compatibility**: Ensures edge target ports exist, source outputs exist, and verifies type compatibility (`number` cannot connect directly to `array`).

### 3.2 Topological Planner & Scheduler
- **Planner** ([execution.planner.js](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/backend/src/engine/planner/execution.planner.js)): Computes execution batches where nodes in each tier can execute with all prerequisite dependencies fulfilled.
- **Scheduler** ([dag.scheduler.js](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/backend/src/engine/scheduler/dag.scheduler.js)): Handles execution step-by-step:
  - Resolves inputs from upstream node outputs or fallback configs.
  - Skips nodes downstream of inactive conditional branches.
  - Broadcasts live events (`task:running`, `task:succeeded`, `task:failed`, `workflow:completed`) over SSE.
  - Stores atomic task-level logs in `TaskRun` and generates the final aggregated `report` in `WorkflowRun`.

---

## 4. Authoritative 36-Node Registry Directory

The engine includes 36 production nodes organized into 8 functional categories:

| Category | Type Identifier | Description | Input Ports | Output Ports |
| :--- | :--- | :--- | :--- | :--- |
| **Triggers** | `trigger.manual` | Manual user-invoked graph trigger | None | `output` (any) |
| | `trigger.webhook` | Inbound HTTP POST endpoint trigger | None | `output` (object) |
| | `trigger.cron` | Scheduled time-based cron trigger | None | `output` (object) |
| **Logic & Control** | `logic.condition` | Binary conditional branch evaluation | `input` (any) | `true`, `false` |
| | `logic.switch` | Multi-way value routing | `value` (string/num), `data` (any) | Dynamic cases, `default` |
| | `flow.delay` | Non-blocking execution pause | `input` (any) | `output` (any) |
| | `flow.merge` | Merges converging upstream paths | Dynamic inputs | `output` (any) |
| **AI Intelligence**| `ai.classify` | Zero-shot text categorization | `text` (string) | Dynamic classes, `category` |
| | `ai.extract` | Schema-driven entity extraction | `text` (string) | `extracted` (object) |
| | `ai.summarize` | Intelligent text condensation | `text` (string) | `summary` (string) |
| **Data & Objects** | `data.validate` | Schema & required fields assertion | `input` (object) | `output` (object) |
| | `data.object` | Custom JSON builder & transformer | `input` (any), `value` (any) | `output` (object) |
| | `data.input` | Static JSON input injector | None | `output` (any) |
| | `data.array.map` | Array transformation & property mapping| `array` (array) | `output` (array) |
| **JSON Utilities** | `json.parse` | Safe string to object conversion | `input` (string) | `output` (any) |
| | `json.get` | Dot-notation deep property lookup | `input` (object) | `output` (any) |
| **HTTP & Web** | `http.request` | SSRF-safe HTTP request client | `body` (any), `headers` (obj) | `data` (any), `status`, `headers` |
| | `http.respond` | Formatted webhook response payload | `data` (any) | `output` (any) |
| **Math Engine** | `math.add` | Arithmetic addition ($A + B$) | `a` (number), `b` (number) | `output` (number) |
| | `math.subtract`| Arithmetic subtraction ($A - B$) | `a` (number), `b` (number) | `output` (number) |
| | `math.multiply`| Arithmetic multiplication ($A \times B$) | `a` (number), `b` (number) | `output` (number) |
| | `math.divide` | Division with zero protection | `a` (number), `b` (number) | `output` (number) |
| | `math.modulo` | Remainder operation ($A \pmod B$) | `a` (number), `b` (number) | `output` (number) |
| | `math.power` | Exponentiation ($A^B$) | `a` (number), `b` (number) | `output` (number) |
| | `math.round` | Floor / Ceil / Round / Precision | `input` (number) | `output` (number) |
| | `math.abs` | Absolute value computation | `input` (number) | `output` (number) |
| | `math.min` | Minimum of numbers or array | `a`, `b`, or array | `output` (number) |
| | `math.max` | Maximum of numbers or array | `a`, `b`, or array | `output` (number) |
| | `math.average`| Average of numbers or array | `a`, `b`, or array | `output` (number) |
| **Text & Output** | `text.template` | Mustache-style `{{key}}` templating| `input` (object) | `output` (string) |
| | `text.concat` | String concatenation with delimiter | `a` (string), `b` (string) | `output` (string) |
| | `output.log` | Diagnostic server console output | `input` (any) | `output` (any) |
| | `output.return` | Final workflow result output | `input` (any) | `output` (any) |
| **Utilities** | `utility.datetime`| UTC/ISO time formatting | `timestamp` (optional) | `formatted`, `iso`, `unix` |
| | `utility.uuid` | Cryptographic UUIDv4 generator | None | `uuid` (string) |

---

## 5. AI Integration & Groq LLM Runtime

The AI system is powered by **Groq Cloud API** running ultra-fast inference with **LLaMA 3.3 70B Versatile** (`llama-3.3-70b-versatile`):
- **Structured JSON Mode**: Uses `response_format: { type: "json_object" }` to guarantee machine-readable JSON output.
- **Fail-Safe Offline Mode**: When `ALLOW_OFFLINE_MOCK="true"` or when Groq API keys are missing/rate-limited, the engine falls back to heuristic rule-based classifiers and extractors so tests and offline development never fail.
- **AI Telemetry Tracking**: All AI tasks capture prompt tokens, completion tokens, latency ($ms$), confidence scores, and reasoning explanations.

---

## 6. Triggers, Webhooks, SSE & Cron Infrastructure

### 6.1 Webhook System
- **Endpoint**: `POST /api/webhooks/:workflowId`
- **Execution Flow**: Inbound payloads trigger the workflow asynchronously or synchronously. The response returns the execution status, execution duration, final output payload, and a direct URL to the complete execution report (`/runs/:runId`).

### 6.2 Server-Sent Events (SSE)
- **Endpoint**: `GET /api/runs/:runId/events`
- Allows real-time streaming of node transitions (`PENDING` $\to$ `RUNNING` $\to$ `SUCCEEDED` / `FAILED`) directly to the visual canvas and execution timeline.

### 6.3 Cron Automation Service
- Integrated with `node-cron`. Registered cron nodes schedule recurring background executions and track history in PostgreSQL.

---

## 7. Authentication, Security & Session Management

### 7.1 Multi-Layered Authentication
- **Dual-Token System**: Short-lived Access Tokens (JWT, 15m) + Long-lived Rotating Refresh Tokens (7d).
- **Session Revocation**: Stored in the `Session` table with client IP, user-agent, and hash comparison. Allows instant "log out all devices".
- **Google OAuth 2.0**: Native OAuth integration with profile synchronization.
- **Email Verification**: Cryptographic token generation and verification flows.

### 7.2 SSRF Protection
The HTTP Request node is shielded by [ssrf.validator.js](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/backend/src/engine/utils/ssrf.validator.js):
- Rejects local loopbacks (`127.0.0.1`, `localhost`, `::1`).
- Blocks private IPv4 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- Prohibits cloud metadata endpoints (`169.254.169.254`).
- Performs asynchronous DNS resolution to prevent DNS rebinding attacks.

---

## 8. Backend Services & REST API Specification

### Core Endpoints

| Category | Method | Path | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/auth/register` | User registration |
| | `POST` | `/api/auth/login` | User credential login |
| | `POST` | `/api/auth/refresh` | Rotate access & refresh token |
| | `POST` | `/api/auth/logout` | Revoke current session |
| **Workflows** | `GET` | `/api/workflows` | List user workflows |
| | `POST` | `/api/workflows` | Create workflow with initial version |
| | `GET` | `/api/workflows/:id` | Fetch workflow & latest version |
| | `PUT` | `/api/workflows/:id` | Update workflow definition & increment version |
| | `DELETE`| `/api/workflows/:id` | Delete workflow |
| | `POST` | `/api/workflows/:id/execute` | Execute workflow with manual trigger |
| **Runs & Reports** | `GET` | `/api/runs` | List execution history with filters & pagination |
| | `GET` | `/api/runs/:id` | Fetch complete durable JSON execution report |
| | `GET` | `/api/runs/:id/events` | SSE live execution stream |
| **Webhooks** | `POST` | `/api/webhooks/:workflowId` | Public external trigger endpoint |
| **Nodes** | `GET` | `/api/nodes` | List authoritative node registry catalogue |

---

## 9. Frontend Architecture & Visual Workflow Editor

### 9.1 Frontend Stack
- **Framework**: React 19 + Vite 8
- **Icons**: Lucide React
- **Styling**: Pure Vanilla CSS design system with CSS custom properties, glassmorphism, and HSL palettes.

### 9.2 Editor Components
- [WorkflowEditor.jsx](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/frontend/src/components/workflow/WorkflowEditor.jsx): Full-viewport visual DAG canvas supporting zoom ($0.4\times - 2.2\times$), infinite panning, and auto-layout.
- [NodeCard.jsx](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/frontend/src/components/workflow/NodeCard.jsx): Interactive cards showing port status, error flags, and live execution animations.
- [EdgePath.jsx](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/frontend/src/components/workflow/EdgePath.jsx): Cubic Bézier curves with cycle error highlighting and live execution flow pulses.
- [NodePalette.jsx](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/frontend/src/components/workflow/NodePalette.jsx): Filterable categorized sidebar of all 36 nodes.
- [NodeInspector.jsx](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/frontend/src/components/workflow/NodeInspector.jsx): Real-time parameter configuration drawer with validation error display.
- [ExecutionReportsList.jsx](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/frontend/src/components/workflow/ExecutionReportsList.jsx): Enterprise-grade table for searching, filtering, and sorting execution reports.
- [ExecutionReportDetail.jsx](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/frontend/src/components/workflow/ExecutionReportDetail.jsx): Deep-dive report viewer displaying AI telemetry, step timelines, node inputs/outputs, and logs.

---

## 10. Autonomous AI Operations Center Implementation

The flagship pre-configured pipeline is the **Dormammu AI Operations Center** ([dormammu_ai_operations_center.json](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/backend/workflows/dormammu_ai_operations_center.json)):

```mermaid
graph LR
    Trig[Inbound Incident Ingestion] --> Val[Validate Incident Schema]
    Val --> Norm[Normalize Incident Payload]
    Norm --> AI[Groq AI Classifier & Reasoner]
    Norm --> Users[Extract Affected Users]
    Norm --> ErrRate[Extract Error Rate]
    Users --> Raw[Compute Raw Impact]
    ErrRate --> Raw
    Raw --> Scale[Scale Impact]
    Scale --> Score[Compute Final Score]
    Score --> Build[Build Impact Summary]
    Norm --> Build
    AI --> Route{Severity Switch}
    Build --> Route
    Route -->|critical| Crit[Dispatch Emergency Pager]
    Route -->|warning| Warn[Queue Prompt Investigation]
    Route -->|normal| NormAct[Standard Support Response]
    Crit --> Merge[Merge Actions]
    Warn --> Merge
    NormAct --> Merge
    Merge --> Report[Assemble Operations Report]
    Norm --> Report
    Report --> Out[Final Operations Report]
```

### Key Scenarios Validated:
1. **Critical Outage**: Enterprise payment gateway outage $\to$ classified `critical` $\to$ Dispatches emergency on-call pager.
2. **Normal Billing**: Minor user query $\to$ classified `normal` $\to$ Standard support response generated.
3. **Degraded Service**: High error rate in background job $\to$ classified `warning` $\to$ Investigation ticket created.
4. **Invalid Payload**: Schema mismatch $\to$ caught by `data.validate` with immediate validation rejection.

---

## 11. Testing Suites, Validation Matrices & Verification

The project includes dual automated test suites:
- **Core Engine Test Suite** ([test_workflow_engine.js](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/backend/test_workflow_engine.js)): Validates all 36 nodes, topological cycles, type contracts, and branch switching (60+ assertions).
- **Persistence & API Test Suite** ([test_api_and_integration.js](file:///Users/aayanshniranjan/Projects/Dormammu-Engine/backend/test_api_and_integration.js)): Tests database CRUD, immutable versioning, webhook triggers, execution reports, and owner access isolation.

---

## 12. Environment Configuration & Deployment Topology

### Key Environment Variables (`backend/.env`):
```bash
PORT=5001
NODE_ENV=development
DATABASE_URL="postgresql://user:password@localhost:5432/dormammu_db?schema=public"
JWT_SECRET="your-jwt-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret-key"
FRONTEND_URL="http://localhost:5174"
GROQ_API_KEY="gsk_..."
ALLOW_OFFLINE_MOCK="true"
```

### Running Locally:
```bash
# Backend (Port 5001)
cd backend && npm run dev

# Frontend (Port 5174)
cd frontend && npm run dev
```

---
*Created automatically for Dormammu Engine codebase documentation.*
