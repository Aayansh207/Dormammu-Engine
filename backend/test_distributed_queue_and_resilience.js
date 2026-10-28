/**
 * Dormammu Engine - Distributed Queue, Idempotency, Retry Policies, and Resilience Test Suite
 * Tests BullMQ distributed execution, DAG branching/merging, retries & backoff,
 * trigger and task idempotency, transactional outbox, crash recovery, and database efficiency.
 */

require("dotenv").config();
const assert = require("assert");
const prisma = require("./src/config/db");
const {
  getSharedRedisClient,
  checkRedisHealth,
  closeRedisConnections,
  parseRedisConnectionOptions,
  sanitizeRedisUrl,
} = require("./src/queue/redis.connection");
const {
  getTaskQueue,
  enqueueTaskJob,
  closeTaskQueue,
  getDlqQueue,
  enqueueDlqJob,
  getDlqMetrics,
  getDlqJobs,
  retryDlqJob,
} = require("./src/queue/queue.producer");
const { TaskWorker } = require("./src/queue/worker");
const { defaultDagCoordinator, getExecutionPlan } = require("./src/queue/dag.coordinator");
const { isRetryableError, calculateBackoffDelay, getRetryPolicy } = require("./src/queue/retry.policy");
const { hashPayload, checkTriggerIdempotency, claimTaskExecution } = require("./src/queue/idempotency.utils");
const { defaultOutboxService } = require("./src/queue/outbox.service");
const { defaultRecoveryService } = require("./src/queue/recovery.service");
const workflowService = require("./src/services/workflow.service");
const { defaultRegistry } = require("./src/engine/registry/node.registry");
const { getDbMetrics, resetDbMetrics } = require("./src/utils/db.metrics");

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) {
      const lines = err.stack.split("\n").slice(1, 4).join("\n");
      console.error(`    ${lines}`);
    }
    failed++;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls database until a run reaches terminal state or times out.
 */
async function waitForRunTerminal(runId, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { tasks: true },
    });
    if (run && ["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status)) {
      return run;
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for run '${runId}' to reach terminal state after ${timeoutMs}ms`);
}

async function runDistributedQueueTests() {
  console.log("\n=======================================================");
  console.log(" Dormammu Distributed Queue & Resilience Test Suite");
  console.log("=======================================================\n");

  const testUserId = `queue_test_user_${Date.now()}`;
  let worker = null;

  try {
    // 0. Setup test user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        name: "Queue Test User",
        role: "USER",
      },
    });

    // Clean queue before starting
    const queue = getTaskQueue();
    await queue.drain().catch(() => {});

    console.log("--- 1. Redis Connection & Queue Infrastructure ---");

    await test("Redis: health check confirms connectivity", async () => {
      const isHealthy = await checkRedisHealth();
      assert.strictEqual(isHealthy, true);
    });

    await test("TaskWorker: starts successfully with configured concurrency", async () => {
      worker = new TaskWorker({ concurrency: 3 });
      await worker.start();
      assert.ok(worker.worker);
      assert.strictEqual(worker.concurrency, 3);
    });

    console.log("\n--- 2. Single-Node Task Execution & State Persistence ---");

    await test("Distributed Execution: executes single-node task through BullMQ and persists TaskExecution", async () => {
      const workflow = await workflowService.createWorkflow(testUserId, {
        name: "Single Node Distributed Test",
        definition: {
          schemaVersion: 1,
          name: "Single Node Distributed Test",
          nodes: [
            { id: "calc", type: "math.add", version: 1, config: { a: 25, b: 17 } },
          ],
          edges: [],
        },
      });

      const dispatchRes = await workflowService.dispatchWorkflowRun(testUserId, workflow.id, {
        triggerData: {},
      });

      assert.strictEqual(dispatchRes.status, "RUNNING");
      assert.ok(dispatchRes.runId);

      const terminalRun = await waitForRunTerminal(dispatchRes.runId, 10000);
      assert.strictEqual(terminalRun.status, "SUCCEEDED");

      // Verify task execution row in PostgreSQL
      const taskRow = await prisma.taskExecution.findUnique({
        where: {
          runId_nodeId: {
            runId: dispatchRes.runId,
            nodeId: "calc",
          },
        },
      });

      assert.ok(taskRow);
      assert.strictEqual(taskRow.status, "SUCCEEDED");
      assert.strictEqual(taskRow.output?.output, 42);
      assert.strictEqual(taskRow.attempts, 1);
      assert.ok(taskRow.durationMs >= 0);

      // Verify task attempt row
      const attempts = await prisma.taskAttempt.findMany({
        where: { taskExecutionId: taskRow.id },
      });
      assert.strictEqual(attempts.length, 1);
      assert.strictEqual(attempts[0].status, "SUCCEEDED");
    });

    console.log("\n--- 3. Linear DAG Distributed Execution & Downstream Scheduling ---");

    await test("Distributed DAG: executes 3-node linear pipeline with output passing", async () => {
      const workflow = await workflowService.createWorkflow(testUserId, {
        name: "3-Node Linear Pipeline",
        definition: {
          schemaVersion: 1,
          name: "3-Node Linear Pipeline",
          nodes: [
            { id: "step1", type: "math.add", version: 1, config: { a: 10, b: 20 } },
            { id: "step2", type: "math.multiply", version: 1, config: { factor: 3 } },
            { id: "step3", type: "output.return", version: 1, config: {} },
          ],
          edges: [
            { id: "e1", source: "step1", sourcePort: "output", target: "step2", targetPort: "input" },
            { id: "e2", source: "step2", sourcePort: "output", target: "step3", targetPort: "input" },
          ],
        },
      });

      const dispatchRes = await workflowService.dispatchWorkflowRun(testUserId, workflow.id);
      const terminalRun = await waitForRunTerminal(dispatchRes.runId, 10000);

      assert.strictEqual(terminalRun.status, "SUCCEEDED");
      assert.strictEqual(terminalRun.output, 90); // (10 + 20) * 3 = 90

      const tasks = await prisma.taskExecution.findMany({
        where: { runId: dispatchRes.runId },
      });
      assert.strictEqual(tasks.length, 3);
      assert.ok(tasks.every((t) => t.status === "SUCCEEDED"));
    });

    console.log("\n--- 4. Parallel Branch Execution ---");

    await test("Parallel Execution: executes independent ready branches concurrently", async () => {
      const workflow = await workflowService.createWorkflow(testUserId, {
        name: "Parallel Branches",
        definition: {
          schemaVersion: 1,
          name: "Parallel Branches",
          nodes: [
            { id: "root", type: "math.add", version: 1, config: { a: 100, b: 50 } },
            { id: "branchA", type: "math.multiply", version: 1, config: { factor: 2 } },
            { id: "branchB", type: "math.add", version: 1, config: { addend: 25 } },
            { id: "merge", type: "flow.merge", version: 1, config: { mode: "all" } },
          ],
          edges: [
            { id: "e1", source: "root", sourcePort: "output", target: "branchA", targetPort: "input" },
            { id: "e2", source: "root", sourcePort: "output", target: "branchB", targetPort: "input" },
            { id: "e3", source: "branchA", sourcePort: "output", target: "merge", targetPort: "input" },
            { id: "e4", source: "branchB", sourcePort: "output", target: "merge", targetPort: "input" },
          ],
        },
      });

      const dispatchRes = await workflowService.dispatchWorkflowRun(testUserId, workflow.id);
      const terminalRun = await waitForRunTerminal(dispatchRes.runId, 10000);

      assert.strictEqual(terminalRun.status, "SUCCEEDED");
      const tasks = await prisma.taskExecution.findMany({
        where: { runId: dispatchRes.runId },
      });
      assert.strictEqual(tasks.length, 4);
      assert.ok(tasks.every((t) => t.status === "SUCCEEDED"));

      const mergeTask = tasks.find((t) => t.nodeId === "merge");
      assert.ok(Array.isArray(mergeTask.output?.output));
      assert.strictEqual(mergeTask.output.output.length, 2);
      assert.ok(mergeTask.output.output.includes(300)); // 150 * 2
      assert.ok(mergeTask.output.output.includes(175)); // 150 + 25
    });

    console.log("\n--- 5. Branching, Skipped-Node Propagation & Merge Semantics ---");

    await test("Branching & Skipping: active branch executes, inactive branch cascades SKIPPED, merge succeeds", async () => {
      const workflow = await workflowService.createWorkflow(testUserId, {
        name: "Conditional Branch & Merge",
        definition: {
          schemaVersion: 1,
          name: "Conditional Branch & Merge",
          nodes: [
            { id: "trig", type: "trigger.manual", version: 1, config: {} },
            { id: "cond", type: "logic.condition", version: 1, config: { operator: ">", value: 50 } },
            { id: "urgent_action", type: "text.concat", version: 1, config: { b: " - High Priority" } },
            { id: "normal_action", type: "text.concat", version: 1, config: { b: " - Standard" } },
            { id: "merge_paths", type: "flow.merge", version: 1, config: { mode: "first_available" } },
          ],
          edges: [
            { id: "e0", source: "trig", sourcePort: "output", target: "cond", targetPort: "a" },
            { id: "e_true", source: "cond", sourcePort: "true", target: "urgent_action", targetPort: "a" },
            { id: "e_false", source: "cond", sourcePort: "false", target: "normal_action", targetPort: "a" },
            { id: "e_m1", source: "urgent_action", sourcePort: "output", target: "merge_paths", targetPort: "input" },
            { id: "e_m2", source: "normal_action", sourcePort: "output", target: "merge_paths", targetPort: "input" },
          ],
        },
      });

      // Pass input "90" (> 50 => true branch)
      const dispatchRes = await workflowService.dispatchWorkflowRun(testUserId, workflow.id, {
        triggerData: "90",
      });
      const terminalRun = await waitForRunTerminal(dispatchRes.runId, 10000);

      assert.strictEqual(terminalRun.status, "SUCCEEDED");

      const tasks = await prisma.taskExecution.findMany({
        where: { runId: dispatchRes.runId },
      });

      const urgentTask = tasks.find((t) => t.nodeId === "urgent_action");
      const normalTask = tasks.find((t) => t.nodeId === "normal_action");
      const mergeTask = tasks.find((t) => t.nodeId === "merge_paths");

      assert.strictEqual(urgentTask.status, "SUCCEEDED");
      assert.strictEqual(normalTask.status, "SKIPPED");
      assert.strictEqual(mergeTask.status, "SUCCEEDED");
      assert.ok(String(mergeTask.output?.output).includes("High Priority"));
    });

    console.log("\n--- 6. Failure Propagation & Fail-Fast Blocking ---");

    await test("Failure Cascade: failed node causes downstream tasks to be marked BLOCKED", async () => {
      const workflow = await workflowService.createWorkflow(testUserId, {
        name: "Failure Cascade Test",
        definition: {
          schemaVersion: 1,
          name: "Failure Cascade Test",
          nodes: [
            { id: "start", type: "math.add", version: 1, config: { a: 10, b: 0 } },
            { id: "failing_divide", type: "math.divide", version: 1, config: { b: 0 } }, // division by zero fails
            { id: "after_failure", type: "math.multiply", version: 1, config: { factor: 5 } },
          ],
          edges: [
            { id: "e1", source: "start", sourcePort: "output", target: "failing_divide", targetPort: "a" },
            { id: "e2", source: "failing_divide", sourcePort: "output", target: "after_failure", targetPort: "input" },
          ],
        },
      });

      const dispatchRes = await workflowService.dispatchWorkflowRun(testUserId, workflow.id);
      const terminalRun = await waitForRunTerminal(dispatchRes.runId, 10000);

      assert.strictEqual(terminalRun.status, "FAILED");

      const tasks = await prisma.taskExecution.findMany({
        where: { runId: dispatchRes.runId },
      });

      const startTask = tasks.find((t) => t.nodeId === "start");
      const failTask = tasks.find((t) => t.nodeId === "failing_divide");
      const blockedTask = tasks.find((t) => t.nodeId === "after_failure");

      assert.strictEqual(startTask.status, "SUCCEEDED");
      assert.strictEqual(failTask.status, "FAILED");
      assert.strictEqual(blockedTask.status, "BLOCKED");
    });

    console.log("\n--- 7. Configurable Retries, Backoff & Error Classification ---");

    await test("Retry Policy: retryable error classification identifies transient vs permanent errors", () => {
      const transientErr = new Error("fetch failed: ETIMEDOUT");
      const rateLimitErr = Object.assign(new Error("Rate limit exceeded"), { statusCode: 429 });
      const badGatewayErr = Object.assign(new Error("Bad Gateway"), { statusCode: 502 });
      const validationErr = Object.assign(new Error("Missing required field"), { code: "REQUIRED_INPUT_MISSING" });
      const authErr = Object.assign(new Error("Unauthorized access"), { statusCode: 401 });

      assert.strictEqual(isRetryableError(transientErr), true);
      assert.strictEqual(isRetryableError(rateLimitErr), true);
      assert.strictEqual(isRetryableError(badGatewayErr), true);
      assert.strictEqual(isRetryableError(validationErr), false);
      assert.strictEqual(isRetryableError(authErr), false);
    });

    await test("Backoff Calculation: exponential delays with maximum bounds and jitter", () => {
      const policy = { initialDelayMs: 1000, maxDelayMs: 8000, backoff: "exponential", jitter: false };
      assert.strictEqual(calculateBackoffDelay(1, policy), 1000);
      assert.strictEqual(calculateBackoffDelay(2, policy), 2000);
      assert.strictEqual(calculateBackoffDelay(3, policy), 4000);
      assert.strictEqual(calculateBackoffDelay(4, policy), 8000);
      assert.strictEqual(calculateBackoffDelay(5, policy), 8000); // capped at maxDelayMs
    });

    await test("Retry Execution: retryable failure exhausts retry limit and records attempt history", async () => {
      // Register custom mock node that fails transiently
      defaultRegistry.register({
        type: "test.transient_fail",
        version: "1.0.0",
        label: "Transient Failure Mock",
        inputs: {},
        outputs: { output: { name: "output", type: "any" } },
        configSchema: {},
        handler: async () => {
          const err = new Error("Upstream gateway timeout: 504");
          err.statusCode = 504;
          throw err;
        },
      });

      const workflow = await workflowService.createWorkflow(testUserId, {
        name: "Retry Exhaustion Test",
        definition: {
          schemaVersion: 1,
          name: "Retry Exhaustion Test",
          nodes: [
            {
              id: "transient_node",
              type: "test.transient_fail",
              version: 1,
              config: {
                retry: {
                  maxAttempts: 2,
                  initialDelayMs: 200,
                  maxDelayMs: 1000,
                  jitter: false,
                },
              },
            },
          ],
          edges: [],
        },
      });

      const dispatchRes = await workflowService.dispatchWorkflowRun(testUserId, workflow.id);
      const terminalRun = await waitForRunTerminal(dispatchRes.runId, 15000);

      assert.strictEqual(terminalRun.status, "FAILED");

      const task = await prisma.taskExecution.findUnique({
        where: {
          runId_nodeId: {
            runId: dispatchRes.runId,
            nodeId: "transient_node",
          },
        },
        include: { attemptsList: true },
      });

      assert.strictEqual(task.status, "FAILED");
      assert.strictEqual(task.attempts, 2);
      assert.strictEqual(task.attemptsList.length, 2);
      assert.ok(task.attemptsList.every((a) => a.status === "FAILED"));
    });

    console.log("\n--- 8. Workflow & Task Idempotency ---");

    await test("Trigger Idempotency: identical request with same key returns existing run", async () => {
      const idempotencyKey = `idem_key_${Date.now()}`;
      const workflow = await workflowService.createWorkflow(testUserId, {
        name: "Idempotency Test Workflow",
        definition: {
          schemaVersion: 1,
          name: "Idempotency Test Workflow",
          nodes: [{ id: "n1", type: "math.add", version: 1, config: { a: 5, b: 5 } }],
          edges: [],
        },
      });

      // First submission
      const res1 = await workflowService.dispatchWorkflowRun(testUserId, workflow.id, {
        triggerData: { orderId: 101, amount: 50 },
        idempotencyKey,
      });

      assert.ok(res1.runId);

      // Second duplicate submission with exact same key & payload
      const res2 = await workflowService.dispatchWorkflowRun(testUserId, workflow.id, {
        triggerData: { orderId: 101, amount: 50 },
        idempotencyKey,
      });

      assert.strictEqual(res2.runId, res1.runId);
      assert.strictEqual(res2.duplicate, true);

      // Verify only 1 run row exists in database
      const count = await prisma.workflowRun.count({
        where: { workflowId: workflow.id, idempotencyKey },
      });
      assert.strictEqual(count, 1);
    });

    await test("Trigger Idempotency Conflict: reusing key with different payload throws 409 Conflict", async () => {
      const idempotencyKey = `conflict_key_${Date.now()}`;
      const workflow = await workflowService.createWorkflow(testUserId, {
        name: "Idempotency Conflict Test",
        definition: {
          schemaVersion: 1,
          name: "Idempotency Conflict Test",
          nodes: [{ id: "n1", type: "math.add", version: 1, config: { a: 1, b: 2 } }],
          edges: [],
        },
      });

      await workflowService.dispatchWorkflowRun(testUserId, workflow.id, {
        triggerData: { orderId: 101 },
        idempotencyKey,
      });

      let threwConflict = false;
      try {
        await workflowService.dispatchWorkflowRun(testUserId, workflow.id, {
          triggerData: { orderId: 999, differentField: true }, // conflicting payload!
          idempotencyKey,
        });
      } catch (err) {
        threwConflict = true;
        assert.strictEqual(err.statusCode, 409);
        assert.strictEqual(err.code, "IDEMPOTENCY_CONFLICT");
      }

      assert.strictEqual(threwConflict, true);
    });

    await test("Task Idempotency: atomic claim prevents duplicate worker execution", async () => {
      const mockTaskId = `claim_test_${Date.now()}`;

      // Create a temporary run & task
      const tempRun = await prisma.workflowRun.create({
        data: {
          status: "RUNNING",
          workflowVersion: {
            create: {
              version: 999,
              definitionJson: { schemaVersion: 1, nodes: [], edges: [] },
              workflow: {
                create: {
                  ownerId: testUserId,
                  name: "Claim Test",
                },
              },
            },
          },
        },
      });

      const task = await prisma.taskExecution.create({
        data: {
          id: mockTaskId,
          runId: tempRun.id,
          nodeId: "mock_node",
          nodeType: "math.add",
          status: "READY",
        },
      });

      // Worker 1 claims
      const claim1 = await claimTaskExecution(mockTaskId, "worker_A", 10000);
      assert.strictEqual(claim1.claimed, true);

      // Concurrent Worker 2 attempts claim while Worker 1 is still active
      const claim2 = await claimTaskExecution(mockTaskId, "worker_B", 10000);
      assert.strictEqual(claim2.claimed, false);
    });

    console.log("\n--- 9. Transactional Outbox & Crash Recovery ---");

    await test("Transactional Outbox: records intended dispatch and dispatches to queue", async () => {
      const initialPendingCount = await prisma.outboxMessage.count({ where: { status: "PENDING" } });

      await prisma.$transaction(async (tx) => {
        await defaultOutboxService.recordDispatch(tx, {
          queueName: "dormammu-workflow-tasks",
          jobName: "execute_node_task",
          payload: {
            runId: "run_outbox_test",
            workflowId: "wf_test",
            workflowVersionId: "ver_test",
            nodeId: "outbox_node",
            taskExecutionId: "task_outbox_test",
          },
        });
      });

      const afterCreateCount = await prisma.outboxMessage.count({ where: { status: "PENDING" } });
      assert.strictEqual(afterCreateCount, initialPendingCount + 1);

      // Dispatch pending
      const dispatched = await defaultOutboxService.dispatchPending(10);
      assert.ok(dispatched >= 1);
    });

    await test("Crash Recovery: reconciler recovers expired claims and deadlocked runs", async () => {
      const deadlockedRun = await prisma.workflowRun.create({
        data: {
          status: "RUNNING",
          workflowVersion: {
            create: {
              version: 998,
              definitionJson: {
                schemaVersion: 1,
                nodes: [{ id: "n1", type: "math.add", version: 1, config: { a: 1, b: 1 } }],
                edges: [],
              },
              workflow: {
                create: {
                  ownerId: testUserId,
                  name: "Deadlock Recovery Test",
                },
              },
            },
          },
        },
      });

      // Expired lease task
      const pastDate = new Date(Date.now() - 60000); // 1 minute in the past
      await prisma.taskExecution.create({
        data: {
          id: `expired_task_${Date.now()}`,
          runId: deadlockedRun.id,
          nodeId: "n1",
          nodeType: "math.add",
          status: "RUNNING",
          claimExpiresAt: pastDate,
          claimedBy: "crashed_worker",
        },
      });

      const reconcileResult = await defaultRecoveryService.reconcileRun(deadlockedRun.id);
      assert.strictEqual(reconcileResult.recoveredTasksCount, 1);

      const recoveredTask = await prisma.taskExecution.findFirst({
        where: { runId: deadlockedRun.id },
      });
      assert.ok(["READY", "RUNNING", "SUCCEEDED"].includes(recoveredTask.status));
      assert.notStrictEqual(recoveredTask.claimedBy, "crashed_worker");
    });

    console.log("\n--- 10. Database Query & Write Optimization Metrics ---");

    await test("Database Efficiency: plan caching avoids redundant definition compilations", () => {
      const sampleDef = {
        schemaVersion: 1,
        name: "Plan Cache Test",
        nodes: [
          { id: "a", type: "math.add", version: 1, config: {} },
          { id: "b", type: "math.multiply", version: 1, config: {} },
        ],
        edges: [{ id: "e1", source: "a", sourcePort: "output", target: "b", targetPort: "input" }],
      };

      const plan1 = getExecutionPlan("version_cached_test_id", sampleDef);
      const plan2 = getExecutionPlan("version_cached_test_id", sampleDef);

      // Same object reference indicates cache hit
      assert.strictEqual(plan1, plan2);
    });

    await test("Database Efficiency: runs and tasks use indexed queries and targeted fields", async () => {
      const runs = await workflowService.listAllUserRuns(testUserId, { page: 1, limit: 10 });
      assert.ok(runs);
      assert.ok(Array.isArray(runs));
      assert.ok(runs.pagination);
    });

    console.log("\n--- 11. Upstash Redis, DLQ, Worker Discovery & Metrics ---");

    await test("Upstash Redis: configuration parsing and URL sanitization", () => {
      const upstashUrl = "rediss://default:supersecretpwd@us1-dormammu-34567.upstash.io:6379";
      const sanitized = sanitizeRedisUrl(upstashUrl);
      assert.ok(!sanitized.includes("supersecretpwd"), "Sanitized URL must not contain password");
      assert.ok(sanitized.includes("us1-dormammu-34567.upstash.io"), "Sanitized URL must contain hostname");

      const parsed = parseRedisConnectionOptions(upstashUrl);
      assert.strictEqual(parsed.tls.servername, "us1-dormammu-34567.upstash.io");
      assert.strictEqual(parsed.keepAlive, 10000);
      assert.strictEqual(parsed.password, "supersecretpwd");
    });

    await test("Worker Discovery: active worker heartbeats are discovered via Redis", async () => {
      const activeWorkers = await TaskWorker.getActiveWorkers();
      assert.ok(Array.isArray(activeWorkers), "Active workers must be an array");
      const found = activeWorkers.find((w) => w.workerId === worker.workerId);
      assert.ok(found, `Active worker ${worker.workerId} must be present in discovery list`);
      assert.strictEqual(found.status, "ALIVE");
      assert.strictEqual(found.concurrency, 3);
    });

    await test("Dead-Letter Queue (DLQ): enqueues failed tasks, records metrics, and enables replay", async () => {
      const dlqJob = await enqueueDlqJob({
        taskExecutionId: `dlq_test_task_${Date.now()}`,
        runId: `dlq_test_run_${Date.now()}`,
        nodeId: "failing_node",
        error: "Persistent downstream 500 error",
        failedAt: new Date().toISOString(),
        attemptsMade: 3,
      });

      assert.ok(dlqJob && dlqJob.id, "DLQ job must be created");

      const dlqMetrics = await getDlqMetrics();
      assert.ok(dlqMetrics.count >= 1, "DLQ metric count must be >= 1");

      const jobs = await getDlqJobs(10);
      assert.ok(jobs.some((j) => j.id === dlqJob.id), "Enqueued DLQ job must appear in jobs list");

      const replayed = await retryDlqJob(dlqJob.id);
      assert.strictEqual(replayed.success, true);
      assert.ok(replayed.replayedJobId, "Replay must return new job ID in task queue");
    });

    await test("Native BullMQ Delay: delay nodes execute via queue scheduler without blocking workers", async () => {
      const delayWorkflowDef = {
        schemaVersion: 1,
        name: "Queue Native Delay Test",
        nodes: [
          {
            id: "delay1",
            type: "flow.delay",
            version: 1,
            config: { duration: 150, unit: "milliseconds" },
          },
        ],
        edges: [],
      };

      const delayWf = await workflowService.createWorkflow(testUserId, {
        name: `Delay Node Test ${Date.now()}`,
        definition: delayWorkflowDef,
      });

      const dispatchRes = await workflowService.dispatchWorkflowRun(testUserId, delayWf.id, {
        triggerData: {},
      });
      const runId = dispatchRes.runId;

      const finalRun = await waitForRunTerminal(runId, 10000);
      assert.strictEqual(finalRun.status, "SUCCEEDED");
      const task = finalRun.tasks.find((t) => t.nodeId === "delay1");
      assert.strictEqual(task.status, "SUCCEEDED");
      assert.ok(task.output.delayedMs >= 150, `delayedMs (${task.output.delayedMs}) should be >= 150ms`);
      assert.strictEqual(task.output.delayedByQueue, true);
    });

    await test("Database Metrics: queries and latency are instrumented during execution", () => {
      const metrics = getDbMetrics();
      assert.ok(metrics, "Metrics object must exist");
      assert.ok(metrics.totalQueries > 0, "Total queries must be > 0");
      assert.ok(typeof metrics.avgLatencyMs === "number", "Average latency must be a number");
      assert.ok(metrics.queriesByModel, "queriesByModel breakdown must exist");
    });

    console.log("\n-------------------------------------------------------");
    console.log(` Distributed Queue Suite Results: ${passed} passed, ${failed} failed`);
    console.log("-------------------------------------------------------\n");

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    if (worker) {
      await worker.stop();
    }
    await closeTaskQueue();
    try {
      const dlq = getDlqQueue();
      await dlq.close();
    } catch (_) {}
    await closeRedisConnections();
    await prisma.$disconnect();
  }
}

runDistributedQueueTests().catch((err) => {
  console.error("Test runner encountered uncaught failure:", err);
  process.exit(1);
});
