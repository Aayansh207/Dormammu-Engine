# 🏛️ Dormammu AI Operations Center — System Specification & Technical Roadmap

## 1. Executive Summary & Objective

The **Dormammu AI Operations Center** transforms the Dormammu Workflow Engine from a synthetic DAG node execution demonstration into an enterprise-grade, data-driven autonomous incident investigation and response system.

The core orchestration engine, sequential topological scheduler, branch skipping (`SKIPPED`), node registry, SSE event streaming, Prisma persistence, and React frontend editor are fully implemented and verified. This specification details the audit of the existing 17-node flagship workflow and defines the blueprint to transition from static pass-through demonstration logic into meaningful operational computing.

---

## 2. Phase 1 Audit: Existing Flagship Workflow (`dormammu_ai_operations_center.json`)

The existing 17-node workflow was audited node-by-node against actual execution behavior, input/output data contracts, and report generation capability:

| Node ID | Node Type | Current Role | Meaningful vs Placeholder Evaluation | Identified Gap & Refinement Need |
| :--- | :--- | :--- | :--- | :--- |
| `trig_ops` | `trigger.manual` | Ingests initial incident payload | **Meaningful**: Correctly supplies trigger payload to downstream nodes. | Uses legacy field names (`ticketId` instead of `incident_id`). |
| `validate_incident` | `data.validate` | Validates required fields and ranges | **Meaningful**: Enforces non-empty fields and numeric bounds `errorRate: [0, 1]`. | Needs updated Phase 2 schema (`latency_ms`, `failed_transactions`, `revenue_at_risk`, `recent_deploy`, `logs`). |
| `normalize_incident` | `data.object` | Restructures input payload | **Meaningful**: Sanitizes and packages fields into normalized incident object. | Must map canonical fields and extract log evidence. |
| `ai_classifier` | `ai.classify` | Groq AI classification | **Meaningful**: Uses Groq LPU (`llama-3.3-70b-versatile` / `openai/gpt-oss-120b`) for live categorization and severity assessment. | Needs log pattern analysis and strict output validation before downstream usage. |
| `get_affected_users` | `json.get` | Extracts `affectedUsers` | **Pass-through / Helper**: Extracts single numeric field. | Can be retained or merged with multi-field arithmetic. |
| `get_error_rate` | `json.get` | Extracts `errorRate` | **Pass-through / Helper**: Extracts single numeric field. | Can be retained or merged with multi-field arithmetic. |
| `calc_raw_impact` | `math.multiply` | Computes `users * errorRate` | **Meaningful**: Real arithmetic calculation of impacted user volume. | Formula needs financial exposure and latency weighting. |
| `calc_scale_impact` | `math.multiply` | Applies factor `0.190476` | **Meaningful**: Rescales impact to 0-100 scale. | Should use documented, clear business weighting. |
| `calc_impact_score` | `math.round` | Rounds impact score | **Meaningful**: Integer rounding. | Retain as normalized impact index. |
| `build_impact_summary` | `data.object` | Packages impact metrics | **CRITICAL GAP (DEAD BRANCH)**: Output was **completely disconnected** with no outgoing edge to report or routing! | Output must be wired into report assembly and routing. |
| `route_switch` | `logic.switch` | 3-way branch on severity | **Meaningful**: Directs execution down `critical`, `warning`, or `normal` branch; cascades `SKIPPED`. | Currently routes solely on AI string rather than combined calculated metrics + AI. |
| `action_critical` | `text.template` | Emergency pager notice | **Placeholder**: Produces only a 1-line text string. | Needs structured escalation plan, required actions, and human approval status. |
| `action_warning` | `text.template` | Investigation notice | **Placeholder**: Produces only a 1-line text string. | Needs structured investigation plan with verification checklists. |
| `action_normal` | `text.template` | Standard support notice | **Placeholder**: Produces only a 1-line text string. | Needs routine resolution guidance without unnecessary pager dispatch. |
| `merge_actions` | `flow.merge` | Joins active action branch | **Meaningful**: Demonstrates inactive branch skipping and active branch coalesce. | Retain for joining conditional action branches. |
| `assemble_final_report`| `data.object` | Packages final output | **CRITICAL GAP**: Only included raw incident fields and `actionSummary`. Discarded AI reasoning, confidence, and impact scores! | Must assemble full, structured incident investigation report separating facts, telemetry, calculations, and hypotheses. |
| `ops_return` | `output.return` | Emits final workflow return | **Meaningful**: Standard engine terminal sink. | Retain. |

---

## 3. Phase 2: Incident Data Contract Specification

### 3.1 Versioned Incident Input Schema (`v1.0.0`)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "IncidentInputPayload",
  "type": "object",
  "required": [
    "incident_id",
    "service",
    "error_rate",
    "latency_ms",
    "affected_users",
    "failed_transactions",
    "region"
  ],
  "properties": {
    "incident_id": { "type": "string", "pattern": "^INC-[A-Z0-9-]+$" },
    "service": { "type": "string", "enum": ["payment-gateway", "auth-service", "checkout-api", "inventory-db", "billing-worker"] },
    "title": { "type": "string", "minLength": 5 },
    "description": { "type": "string" },
    "error_rate": { "type": "number", "minimum": 0.0, "maximum": 1.0 },
    "latency_ms": { "type": "number", "minimum": 0 },
    "affected_users": { "type": "integer", "minimum": 0 },
    "failed_transactions": { "type": "integer", "minimum": 0 },
    "revenue_at_risk": { "type": "number", "minimum": 0.0 },
    "region": { "type": "string" },
    "customer_tier": { "type": "string", "enum": ["enterprise", "business", "standard", "free"] },
    "recent_deploy": { "type": "boolean" },
    "logs": {
      "type": "array",
      "items": { "type": "string" }
    }
  }
}
```

### 3.2 Four Deterministic Test Fixtures

1. **Scenario 1: Critical Payment Outage**
   - High error rate (`0.48`), extreme latency (`3400ms`), 1,450 affected users, 620 failed transactions, `$54,800` revenue at risk, recent deployment: `true`.
   - Log patterns: `Connection pool exhausted`, `HTTP 504 Gateway Timeout`.
   - Expected Severity: **`critical`**.
2. **Scenario 2: Normal / Routine Billing Inquiry**
   - Zero error rate (`0.0`), baseline latency (`42ms`), 0 affected users, 0 failed transactions, `$0` revenue at risk.
   - Log patterns: `INFO: Invoice generated successfully`.
   - Expected Severity: **`normal`**.
3. **Scenario 3: Degraded Auth Service**
   - Moderate error rate (`0.08`), elevated latency (`850ms`), 280 affected users, 35 failed transactions, `$2,400` revenue at risk.
   - Log patterns: `Token validation timeout`, `WARN: Cache miss spike`.
   - Expected Severity: **`warning`**.
4. **Scenario 4: Invalid / Malformed Incident**
   - Missing required `service` and negative `affected_users: -50`.
   - Expected Behavior: Fails fast at `validate_incident` with `VALIDATION_FAILED`, marking downstream nodes `BLOCKED`.

---

## 4. Phase 3 & 4: Derived Calculations & Data-Driven Routing

### 4.1 Documented Mathematical Formulas

1. **Impacted User Volume**:
   $$\text{impacted\_volume} = \text{affected\_users} \times \text{error\_rate}$$
2. **Normalized Business Impact Score** (0 to 100):
   $$\text{raw\_score} = (\text{affected\_users} \times \text{error\_rate} \times 0.08) + (\text{failed\_transactions} \times 0.05) + (\text{latency\_ms} / 100)$$
   $$\text{impact\_score} = \min(100, \text{round}(\text{raw\_score}))$$
3. **Financial Exposure Index**:
   $$\text{financial\_exposure} = \text{revenue\_at\_risk} \times (\text{customer\_tier} == \text{'enterprise'} ? 1.5 : 1.0)$$

### 4.2 Severity Decision Matrix

| Metric Threshold | AI Category | Final Severity | Route Selected | Escalation Action |
| :--- | :--- | :--- | :--- | :--- |
| `impact_score >= 70` OR `error_rate >= 0.25` | `service_outage` | **`critical`** | `action_critical` | PagerDuty on-call dispatch + executive alert |
| `impact_score >= 30` OR `latency_ms >= 500` | `performance_degradation` | **`warning`** | `action_warning` | DevOps investigation queue + Slack notice |
| `impact_score < 30` AND `error_rate < 0.05` | `support_inquiry` / `routine` | **`normal`** | `action_normal` | Standard business-hours resolution |
| Missing critical telemetry | `unverified` | **`human_review`** | `action_review` | Route to Tier-2 SRE for manual validation |

---

## 5. Phase 5: Controlled Local Mock Monitoring Service

To enrich incidents with realistic infrastructure telemetry, the backend exposes a dedicated, deterministic mock monitoring endpoint:

- **Endpoint**: `GET /api/mock/monitoring/services/:service`
- **Supported Services**: `payment-gateway`, `auth-service`, `checkout-api`, `billing-worker`
- **Telemetry Contract**:
  ```json
  {
    "service": "payment-gateway",
    "providerHealth": "degraded",
    "upstreamStatusCode": 504,
    "lastDeployTimestamp": "2026-10-25T23:10:00Z",
    "recentDeployCommit": "c88f21e (fix: pool connection limit)",
    "activePods": 12,
    "unhealthyPods": 5,
    "p99LatencyMs": 3200,
    "simulatedTelemetry": true
  }
  ```
- **Engine Security**: Invoked via the native `http.request` node with `allowPrivateNetwork: true`, timeout enforcement (10,000ms), and 2MB payload cap.

---

## 6. Phase 6: Actionable Structured Incident Report Contract

The final node (`assemble_final_report` ➔ `ops_return`) emits a transparent, verifiable JSON document:

```json
{
  "reportId": "RPT-INC-8092",
  "generatedAt": "2026-10-26T00:30:00.000Z",
  "workflowRunId": "run_01j...",
  "incident": {
    "id": "INC-8092",
    "service": "payment-gateway",
    "region": "ap-south-1",
    "customerTier": "enterprise"
  },
  "facts": {
    "affectedUsers": 1200,
    "errorRate": 0.42,
    "latencyMs": 3400,
    "failedTransactions": 620,
    "revenueAtRisk": 54800,
    "recentDeploy": true,
    "observedLogs": ["504 Gateway Timeout", "Connection pool exhausted"]
  },
  "derivedMetrics": {
    "impactedVolume": 504,
    "impactScore": 96,
    "financialExposure": 82200,
    "severityCalculated": "critical"
  },
  "serviceTelemetry": {
    "providerHealth": "degraded",
    "unhealthyPods": 5,
    "activePods": 12,
    "p99LatencyMs": 3200,
    "recentDeployCommit": "c88f21e",
    "isSimulated": true
  },
  "aiAnalysis": {
    "provider": "groq",
    "model": "openai/gpt-oss-120b",
    "category": "service_outage",
    "confidence": 0.98,
    "leadingHypothesis": "Exhaustion of upstream payment gateway connection pool following commit c88f21e",
    "alternativeExplanations": ["Third-party banking gateway transit degradation in ap-south-1"],
    "isVerifiedFact": false
  },
  "actionPlan": {
    "decision": "critical_escalation",
    "summary": "🚨 CRITICAL OUTAGE ESCALATION: Incident INC-8092 on payment-gateway. Dispatched emergency DevOps on-call pager.",
    "immediateSteps": [
      "Roll back commit c88f21e on payment-gateway deployment",
      "Scale healthy pod replica count from 12 to 24",
      "Flush stale connection pool sockets"
    ],
    "humanApprovalRequired": true
  }
}
```

---

## 7. Implementation & Verification Roadmap

- [x] **Phase 1**: Comprehensive Audit & Specification Document (`docs/AI_OPERATIONS_CENTER_SPEC.md`).
- [x] **Phase 2**: Define versioned incident contract and 6 deterministic fixture files in `backend/workflows/fixtures/`.
- [x] **Phase 3**: Implement mock monitoring endpoint (`/api/mock/monitoring/services/:service`) in backend controller & routes.
- [x] **Phase 4**: Refine 17-node `dormammu_ai_operations_center.json` with log extraction, monitoring enrichment, impact score integration, and actionable report assembly.
- [x] **Phase 5**: Update AI classifier prompt and verification rules to extract hypotheses and alternative explanations cleanly with live Groq AI (`openai/gpt-oss-120b`).
- [x] **Phase 6**: Update frontend `RunExecutionModal.jsx` with quick-switch presets for all 5 scenarios with visual scenario comparison matrix and structured report card.
- [x] **Phase 7**: Comprehensive automated test coverage in `test_workflow_engine.js` (74 passed) and `test_api_and_integration.js` (19 passed).
- [x] **Phase 8**: Production client build verification (`npm run build` completed in 150ms).
