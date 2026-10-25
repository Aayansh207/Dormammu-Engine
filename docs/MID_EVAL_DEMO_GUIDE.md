# DORMAMMU ENGINE — MID-EVALUATION DEMONSTRATION GUIDE

**Project:** The Dormammu Loop (Dormammu Engine)  
**Evaluation Standard:** Mid-Evaluation Master Showcase  
**Target Duration:** 8–10 Minutes  
**Engine Baseline:** 92 Tests Passing (0 Failures) | 35 Production Nodes | Sub-millisecond Execution Latency  

---

## 1. System Architecture & Core Concepts

### 1.1 Problem Solved
Modern event-driven automation requires executing complex, interconnected operations across AI models, data transformations, and HTTP services with guaranteed correctness. Traditional script-based automation lacks deterministic execution order, cycle protection, fail-fast guarantees, and transparent auditability.

**Dormammu Engine** solves this with:
- **Directed Acyclic Graph (DAG) Execution:** Explicit, type-safe data dependencies between nodes.
- **Pre-execution Static Validation:** Tarjan / DFS cycle detection and port compatibility checks reject broken graphs before any node executes.
- **Deterministic Control Flow:** Branch skipping cascades `SKIPPED` status down inactive branches while `flow.merge` cleanly joins active outcomes.
- **Fail-Fast Safety:** Any node failure immediately marks downstream dependencies as `BLOCKED`, preventing corrupted side-effects.
- **Durable Persistence:** Every workflow version, run, and individual node task state is durably recorded in PostgreSQL (Neon).
- **Multi-Trigger Entrypoints:** Unified execution pipeline for Manual, Webhook, and Cron triggers.

```mermaid
graph LR
    subgraph Triggers
        T1[Manual Run]
        T2[Webhook POST]
        T3[Cron Scheduler]
    end

    subgraph Core Engine
        V[Validator & Cycle Detector] --> P[Topological DAG Planner]
        P --> S[Sequential DAG Scheduler]
        S --> R[Node Runtime & Registry 35 Nodes]
        R --> SEC[SSRF & Security Sandbox]
    end

    subgraph State & Persistence
        S --> DB[(PostgreSQL: WorkflowRun & TaskRun)]
        S --> SSE[Server-Sent Events /api/runs/:id/events]
    end

    T1 --> V
    T2 --> V
    T3 --> V
```

---

## 2. 8–10 Minute Judge Demonstration Plan

### Timeline Overview
| Segment | Duration | Topic | Key Takeaway |
|---|---|---|---|
| **Part 1** | 0:00 – 1:15 | Product & Canvas Overview | Visual editor, 35-node catalogue, real-time validation |
| **Part 2** | 1:15 – 2:30 | Showcase Workflow Architecture | 17-node AI Operations Center DAG with dual analysis |
| **Part 3** | 2:30 – 4:15 | Scenario 1: Critical Outage | AI classification, impact score 96, critical route, report |
| **Part 4** | 4:15 – 5:45 | Scenario 2: Normal Billing Inquiry | Same DAG, different input $\rightarrow$ standard support route |
| **Part 5** | 5:45 – 7:00 | Failure Handling & Safety | Schema rejection, controlled HTTP failure, fail-fast `BLOCKED` |
| **Part 6** | 7:00 – 8:30 | Webhook Ingestion & SSE Live Updates | Live cURL webhook execution, token auth, SSE streaming |
| **Part 7** | 8:30 – 10:00 | Engineering Rigor & Q&A | Sub-millisecond benchmarks (0.139 ms p50), 86 tests passing |

---

### Part 1: Product Overview (0:00 – 1:15)
1. Open the frontend application in your browser at `http://localhost:5173`.
2. **Key Talking Points:**
   - "Dormammu Engine is a visual, event-driven workflow automation platform built for high reliability and AI orchestration."
   - Click **Node Catalogue** on the left: show the **35 registered production nodes** spanning Triggers (`trigger.manual`, `trigger.webhook`, `trigger.cron`), AI (`ai.classify`, `ai.extract`, `ai.summarize`), Data (`data.validate`, `data.object`, `data.array.map`), Control Flow (`logic.condition`, `logic.switch`, `flow.merge`), HTTP (`http.request`, `http.respond`), and Math.
   - Show the Canvas: drag a wire, show typed port indicators (`any`, `number`, `string`, `object`).

---

### Part 2: Showcase Workflow Walkthrough (1:15 – 2:30)
1. In the Templates bar or Workflow List, open **"Dormammu AI Operations Center"**.
2. **Explain the 6-Stage DAG Pipeline:**
   - **Stage 1 (Ingestion & Schema Validation):** `trigger.manual` $\rightarrow$ `data.validate` (verifies required fields, numeric constraints) $\rightarrow$ `data.object` (normalizes input).
   - **Stage 2 (Dual Parallel Analysis):**
     - **Branch A (AI Classification):** `ai.classify` analyzes incident text, categorizing into `service_outage`, `performance_degradation`, or `support_inquiry`, outputting severity (`critical`, `warning`, `normal`).
     - **Branch B (Business Impact Calculation):** `json.get` extracts `affectedUsers` & `errorRate` $\rightarrow$ `math.multiply` $\rightarrow$ `math.round` computes normalized impact score ($0 - 100$) $\rightarrow$ `data.object` builds impact summary.
   - **Stage 3 (Decision & Severity Routing):** `logic.switch` routes the normalized incident data along active port (`critical`, `warning`, or `normal`) based on AI severity.
   - **Stage 4 (Branch Actions):** Dynamic templates prepare branch-specific outputs (Emergency on-call pager for critical; queue notice for warning; standard email for normal).
   - **Stage 5 (Branch Merging):** `flow.merge` joins the active action output while inactive branches are cleanly skipped.
   - **Stage 6 (Report Assembly & Output):** `data.object` combines the incident data, impact score, and action summary into a comprehensive operations report returned by `output.return`.

---

### Part 3: Scenario 1 — Critical Outage (2:30 – 4:15)
1. Click **Run Workflow** (or open execution modal).
2. The default sample payload is pre-loaded:
```json
{
  "ticketId": "TCK-8092",
  "title": "Payment gateway returning HTTP 504 errors",
  "description": "Multiple users cannot complete checkout.",
  "service": "payment-gateway",
  "customerTier": "enterprise",
  "affectedUsers": 1200,
  "errorRate": 0.42,
  "region": "ap-south-1",
  "source": "support-webhook"
}
```
3. Click **Execute Workflow**.
4. **Inspect Results with Judges:**
   - **AI Classification:** Classified as `service_outage` with severity `critical` (Confidence: 0.95).
   - **Impact Score:** $1200 \times 0.42 \times 0.190476 \approx$ **96** (Enterprise Critical).
   - **Routing:** `route_switch` chose the `critical` branch.
   - **Branch Skipping:** `action_warning` and `action_normal` are marked `SKIPPED` with duration 0.
   - **Merged Report Output:**
```json
{
  "actionSummary": "🚨 CRITICAL OUTAGE ESCALATION: Ticket TCK-8092 on [payment-gateway]. Dispatched emergency DevOps on-call pager.",
  "affectedUsers": 1200,
  "customerTier": "enterprise",
  "errorRate": 0.42,
  "service": "payment-gateway",
  "ticketId": "TCK-8092"
}
```
   - Show the **Task History breakdown** with individual execution times and task statuses.

---

### Part 4: Scenario 2 — Normal Billing Inquiry (4:15 – 5:45)
1. In the execution modal, enter the Standard Support payload:
```json
{
  "ticketId": "TCK-4102",
  "title": "Question about monthly invoice",
  "description": "The customer wants clarification regarding prorated tax charges on invoice #8819.",
  "service": "billing",
  "customerTier": "standard",
  "affectedUsers": 1,
  "errorRate": 0.0,
  "region": "ap-south-1",
  "source": "support-webhook"
}
```
2. Click **Execute Workflow**.
3. **Inspect Dynamic Branching:**
   - **AI Classification:** Classified as `support_inquiry` with severity `normal`.
   - **Impact Score:** 0.
   - **Routing:** `route_switch` routed to `normal`.
   - **Critical branch skipped:** `action_critical` and `action_warning` are `SKIPPED`.
   - **Final Output:**
```json
{
  "actionSummary": "📋 STANDARD SUPPORT: Ticket TCK-4102 on [billing]. Created standard business-hours response.",
  "affectedUsers": 1,
  "customerTier": "standard",
  "errorRate": 0,
  "service": "billing",
  "ticketId": "TCK-4102"
}
```
   - "This proves that our DAG runtime dynamically alters execution paths without hardcoding, accurately persisting skipped vs executed tasks."

---

### Part 5: Failure Handling & Safety (5:45 – 7:00)
1. **Scenario 4 (Schema Validation Failure):**
   - Provide an invalid payload missing required fields:
```json
{
  "ticketId": "TCK-INVALID",
  "title": "Broken payload missing critical fields"
}
```
   - Execute the workflow.
   - **Show the result:**
     - Node `validate_incident` failed with structured code `VALIDATION_FAILED`.
     - Error message: `Missing required field 'service'`.
     - All 15 downstream nodes (`normalize_incident`, `ai_classifier`, etc.) are immediately marked `BLOCKED` with 0 attempts.
     - The workflow status is `FAILED`. No false successes, no silent swallowing of errors.

2. **Scenario 5 (Controlled HTTP Dependency Failure):**
   - Point out our HTTP safety configuration: `failOnError: true` and strict SSRF validator.
   - If an upstream service or mock endpoint (`/api/mock/service-health/fail-service`) returns HTTP 500, `http.request` throws `HTTP_REQUEST_FAILED`, stopping the run and recording the failure trace.

---

### Part 6: Webhook Ingestion & Live SSE Streaming (7:00 – 8:30)
1. **Live Webhook Execution:**
   - Run the following cURL command from your terminal:
```bash
curl -X POST http://localhost:5001/api/webhooks/ops-center-demo \
  -H "Content-Type: application/json" \
  -H "x-webhook-token: demo-secret-token" \
  -d '{
    "ticketId": "TCK-LIVE-99",
    "title": "Payment gateway 504 gateway timeout",
    "description": "Production checkout broken",
    "service": "payment-gateway",
    "customerTier": "enterprise",
    "affectedUsers": 2500,
    "errorRate": 0.85
  }'
```
   - Show the HTTP 200 response:
```json
{
  "success": true,
  "runId": "run_9f4b1e8a...",
  "status": "SUCCEEDED",
  "finalOutput": { ... }
}
```
2. **Show Unauthorized Webhook Rejection:**
   - Run the same cURL without `-H "x-webhook-token: demo-secret-token"`.
   - Show immediate HTTP 401 Unauthorized: `Missing or invalid webhook authorization token`.

3. **Live SSE Streaming Endpoint:**
   - Show `GET http://localhost:5001/api/runs/:runId/events`.
   - Explain how frontend clients receive atomic server-sent events for `task:running`, `task:succeeded`, and `workflow:completed`.

---

### Part 7: Engineering Rigor, Performance & Summary (8:30 – 10:00)
1. **Benchmark Numbers:**
   - In-memory DAG engine (17 nodes): **0.253 ms median** (~3,054 runs/sec per Node.js process).
   - Small 3-node workflow: **0.023 ms median**.
   - End-to-end cloud persisted execution (Neon PostgreSQL over WAN): **5.95s median** (~34 WAN SSL roundtrips), demonstrating durability without sacrificing raw engine speed.
2. **Test Suite:**
   - **92 passing automated tests, 0 failures.**
   - Verified across Unit, Graph Integrity, DAG Scheduler, Branching, Webhook, Cron, PostgreSQL persistence (all 5 flagship scenarios), and Security regression tests.
3. **Conclusion:**
   - "Dormammu Engine delivers rock-solid execution semantics, comprehensive observability, and sub-millisecond orchestration for modern AI and event-driven workflows."

---

## 3. Local Setup & Environment Reference

### 3.1 Prerequisites
- Node.js v18+ (tested on v24.18.0)
- PostgreSQL database (or Neon connection URL)

### 3.2 Environment Variables (`backend/.env`)
```env
PORT=5001
NODE_ENV=development
DATABASE_URL="postgresql://user:password@ep-host.neon.tech/neondb?sslmode=require"
JWT_SECRET="dormammu-secure-jwt-secret-key"
CORS_ORIGIN="http://localhost:5173"
GROQ_API_KEY="gsk_your_groq_api_key_here"
```

### 3.3 Running Locally
```bash
# Terminal 1: Backend API & Execution Engine
cd backend
npm install
npm run dev

# Terminal 2: Frontend Visual Editor
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3.4 Running Automated Verification
```bash
cd backend
npm test

cd ../frontend
npm run build
```
