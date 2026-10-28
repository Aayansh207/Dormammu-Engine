# Dormammu Loop — Distributed DAG Workflow Engine Architecture

## 1. System Architecture Overview

Dormammu Loop is an event-driven, distributed Directed Acyclic Graph (DAG) workflow automation platform engineered with a strict separation of concerns between durable persistence and distributed background coordination.

```
                      +-----------------------------+
                      |  Client / React UI / Webhook |
                      +--------------+--------------+
                                     |
                                     | HTTP REST / SSE Stream
                                     v
                      +-----------------------------+
                      |     Express API Gateway     |
                      |   (State Acceptance Layer)  |
                      +--------------+--------------+
                                     |
        +----------------------------+----------------------------+
        |                                                         |
        | Durable Transaction                                     | Ephemeral Pub/Sub
        v                                                         v
+-------------------------------+                         +-------------------------------+
|     PostgreSQL (Neon DB)      |                         |      Upstash Redis Cluster    |
|   DURABLE SOURCE OF TRUTH     |                         |   DISTRIBUTED COORDINATION    |
|-------------------------------|                         |-------------------------------|
| • Users, Workspaces, Roles    |                         | • BullMQ Task Queue           |
| • Workflow Definitions & Ver. |                         | • BullMQ Dead-Letter Queue    |
| • Workflow Runs & Inputs      |                         | • BullMQ Native Delayed Jobs  |
| • Task Executions & Outputs   |                         | • Worker Presence Heartbeats  |
| • Task Attempt History        |                         | • Cross-Node SSE Pub/Sub      |
| • Outbox Dispatch Records     |                         | • Temporary Idempotency Cache |
| • Idempotency Constraints     |                         +---------------+---------------+
+---------------+---------------+                                         |
                |                                                         |
                | Atomic Lease & Updates                                  | Job Consumption & Leases
                v                                                         v
        +-----------------------------------------------------------------+
        |                    Autonomous Worker Pool                       |
        |             (Independent Node.js Worker Processes)             |
        |-----------------------------------------------------------------|
        |  Worker 1 (Concurrency=5)  |  Worker 2 (Concurrency=5)  |  ...  |
        |  - Atomic Task Claim       |  - Stalled Job Detection   |       |
        |  - Isolated Node Runtime   |  - Native Delay Dispatch   |       |
        |  - Retry & Jitter Backoff  |  - DLQ Terminal Routing    |       |
        |  - Redis Heartbeat Ping    |  - SSE Event Dispatch      |       |
        +-----------------------------------------------------------------+
                                         |
                                         v
                         +-------------------------------+
                         |      DAG State Coordinator    |
                         |-------------------------------|
                         | • Concurrency-Safe Readiness  |
                         | • Cascading Branch Skipping   |
                         | • Fan-In Edge Synchronization |
                         | • Child Scheduling into Queue |
                         +-------------------------------+
```

---

## 2. Separation of Responsibilities

### PostgreSQL: Durable Source of Truth
PostgreSQL is the single authoritative source of business truth that survives total Redis flushes and network partitions:
- **Workflows & Immutable Versions**: Workflow graphs (`definitionJson`), version numbers, and configurations.
- **Workflow Runs**: Top-level execution runs (`RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`), initial inputs, outputs, timestamps.
- **Task Executions**: Canonical records for every node in a workflow run (`READY`, `RUNNING`, `SUCCEEDED`, `FAILED`, `SKIPPED`, `BLOCKED`).
- **Task Attempts**: Granular audit log of each individual attempt (timestamp, duration, error payload, attempt number).
- **Transactional Outbox**: Intent-to-dispatch records ensuring guaranteed job handoff between database and queue.
- **Durable Idempotency**: Unique database constraint `(workflowId, idempotencyKey)` guaranteeing strictly single run creation.

### Upstash Redis: Distributed Coordination Layer
Upstash Redis is reserved strictly for high-throughput, low-latency coordination:
- **BullMQ Task Queues**: `dormammu:workflow:tasks` storing active, waiting, and delayed jobs.
- **Dead-Letter Queue (DLQ)**: `dormammu:workflow:dlq` holding terminally failed tasks for inspection and operator replay.
- **Delayed Job Scheduling**: Redis sorted sets (`zset`) executing native timer delays (`flow.delay`) without blocking worker threads.
- **Worker Discovery & Heartbeats**: Short-lived hash keys (`dormammu:workers:<workerId>`) with 30s TTL for real-time cluster health.
- **Ephemeral Pub/Sub**: Real-time event broadcasting (`dormammu:events:run:<runId>`) powering Server-Sent Events across multiple API replicas.

---

## 3. Upstash Redis Deployment & TLS Configuration

Dormammu Engine natively supports Upstash Redis managed endpoints over TLS (`rediss://` protocol) with resilience against proxy connection drops:
- **TLS SNI Verification**: Automatic hostname extraction (`servername`) ensuring valid certificate handshakes on cloud hostnames.
- **TCP Keep-Alive Probing**: 10-second keep-alive probes (`keepAlive: 10000`) preventing idle timeouts by cloud NAT firewalls.
- **IPv4 Preference**: Forces `family: 4` avoiding latency penalties caused by IPv6 routing on cloud providers.
- **Jittered Exponential Backoff**: Connection retry strategy with random jitter capping backoff at 3,000ms.
- **URL Credential Sanitization**: Passwords and access tokens are masked in all logs and error diagnostics (`sanitizeRedisUrl`).

### Environment Variables:
```env
# Local Development
REDIS_URL="redis://127.0.0.1:6379"

# Production Upstash Endpoint
REDIS_URL="rediss://default:YOUR_PASSWORD@your-endpoint.upstash.io:6379"
WORKER_CONCURRENCY=5
TASK_LOCK_DURATION_MS=30000
WORKER_HEARTBEAT_INTERVAL_MS=10000
WORKER_HEARTBEAT_TTL_SECONDS=30
DLQ_MAX_JOBS=1000
```

---

## 4. Distributed Execution Pipeline & Lifecycle

### Step 1: Acceptance & Fast Acknowledgment
1. Client submits a trigger request (`POST /api/webhooks/:workflowId?async=true` or `POST /api/workflows/:id/execute` with `mode: "distributed"`).
2. The Express API validates workflow structure and permissions.
3. In a single PostgreSQL transaction:
   - A `WorkflowRun` record is created in `RUNNING` status.
   - Initial `TaskExecution` rows are created (`READY` for entry nodes, `PENDING` for downstream nodes).
4. The API enqueues entry tasks into the BullMQ task queue and returns **`202 Accepted`** in sub-second time with run IDs and event URLs.

### Step 2: Autonomous Worker Consumption
1. An independent worker process picks up the job from BullMQ.
2. The worker atomically claims the task in PostgreSQL (`status = 'RUNNING'`, `claimedBy = workerId`, `claimExpiresAt = now + 30s`).
3. Inputs are resolved from predecessor outputs stored in PostgreSQL.
4. The isolated node runtime executes the node handler.

### Step 3: Concurrency-Safe DAG State Coordination
1. Upon task completion, the worker records the task's outputs and status (`SUCCEEDED`) in PostgreSQL.
2. The `DistributedDagCoordinator` inspects downstream edges:
   - Evaluates incoming edge readiness (AND semantics).
   - Propagates `SKIPPED` status down inactive branches (e.g. from `logic.condition` or `logic.switch`).
   - Identifies newly ready child nodes.
3. Newly ready tasks are transitioned to `READY` in PostgreSQL and enqueued into BullMQ using `queue.addBulk` for downstream workers to process in parallel.

---

## 5. Reliability, Fault Tolerance & Recovery

### Worker Crashes & Lease Expiration
Each task claim is protected by a 30-second lease (`claimExpiresAt`). If a worker crashes or is abruptly killed (`SIGKILL`):
- BullMQ's stalled-job detector notices the unacknowledged job lock.
- The `RecoveryService` (`reconcileRun`) periodically scans for orphaned tasks with expired leases and resets their status to `READY`, releasing them for other workers.

### Dead-Letter Queue (DLQ) & Operator Replay
- When a task fails due to a retryable error, it is rescheduled with exponential backoff and random jitter.
- Once maximum attempts are exhausted (or if an unrecoverable permanent error occurs), the task is marked `FAILED`, downstream nodes are marked `BLOCKED`, and the task is routed into the Dead-Letter Queue (`dormammu:workflow:dlq`).
- Operators can inspect and replay DLQ jobs via REST endpoints:
  - `GET /api/runs/queue/metrics`: Cluster queue and DLQ metrics.
  - `GET /api/runs/dlq`: List dead-lettered tasks with error diagnostics and inputs.
  - `POST /api/runs/dlq/:jobId/retry`: Replays a dead-lettered job into the active queue.

### Idempotency Under High Concurrency
- **Request-Level Idempotency**: Protected by a durable compound unique constraint in PostgreSQL:
  ```sql
  CONSTRAINT "workflow_runs_workflowId_idempotencyKey_key" UNIQUE ("workflowId", "idempotencyKey")
  ```
- **Simultaneous Race Handling**: If multiple concurrent requests arrive with the same key at the exact same millisecond, 1 request creates the run, while concurrent requests catch the `P2002` constraint violation, verify the payload hash consistency, and return the existing run gracefully.

---

## 6. PostgreSQL Query Optimization Telemetry

To protect Neon serverless PostgreSQL from connection pressure and high query volumes, the engine implements:
1. **Execution Plan Caching**: Compiled DAG graphs are cached in memory via LRU (`planCache`), eliminating redundant parsing and topological sorting.
2. **Column Projection**: Intermediate coordination queries select only essential status and output fields (`id`, `nodeId`, `status`, `output`), omitting heavy JSON blobs.
3. **Prisma `$extends` Query Telemetry**: Centralized query duration and count tracking across all models (`db.metrics.js`).

---

## 7. Measured Load Test Benchmarks

Executed on an autonomous cluster connected to Upstash Managed Redis (TLS) and Neon PostgreSQL:

| Benchmark Scenario | Workload | Measured Result | Guarantee / SLA |
|--------------------|----------|-----------------|-----------------|
| **Webhook Ingestion Latency** | 30 HTTP Webhook Dispatches | **Min: 451ms \| P50: 658ms \| Avg: 777ms** | **Sub-second Trigger Acceptance (< 1000ms)** |
| **Concurrent Workflow Scalability** | 20 Concurrent 2-Stage Workflows (40 tasks) | **21,758ms total \| 0.92 runs/sec** | **100% Succeeded (0 failures)** |
| **Parallel DAG Branching** | 5-Node Diamond (3 parallel branches) | **7,554ms end-to-end** | **Accurate fan-out & fan-in synchronization** |
| **Idempotency Collision** | 15 Simultaneous Duplicate Requests | **1 Created Run \| 14 Deduplicated** | **Strict exactly-once workflow creation** |
| **PostgreSQL Telemetry** | 1,747 DB queries recorded | **Avg Latency: 350.25ms** | **Zero N+1 leaks; targeted column selects** |

---

## 8. Deployment & Startup Guide

### 1. Local Development
```bash
# Terminal 1: Backend API Gateway
cd backend
npm install
npm run dev

# Terminal 2: Distributed Background Worker
cd backend
npm run worker

# Terminal 3: React Frontend Canvas
cd frontend
npm install
npm run dev
```

### 2. Production Deployment
1. Set `REDIS_URL` in environment secrets pointing to your Upstash Redis TLS endpoint:
   ```env
   REDIS_URL="rediss://default:YOUR_PASSWORD@your-cluster.upstash.io:6379"
   DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"
   DIRECT_URL="postgresql://user:pass@direct-host/db?sslmode=require"
   ```
2. Run database migrations:
   ```bash
   npm run db:push
   ```
3. Start API instances (Stateless, horizontally scalable):
   ```bash
   node server.js
   ```
4. Start Worker processes (Independently scalable):
   ```bash
   node src/queue/worker.js
   ```
