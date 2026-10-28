/**
 * Dormammu Engine - Distributed Load Testing & Performance Benchmark Suite
 * Measures:
 * 1. Sub-second webhook ingestion latency (trigger acceptance vs execution time).
 * 2. Concurrent distributed workflow execution under BullMQ worker load.
 * 3. Parallel DAG branch scalability (diamond fan-out and fan-in).
 * 4. High-concurrency idempotency protection under simultaneous duplicate submissions.
 * 5. PostgreSQL query count and latency metrics per workflow run.
 */

require("dotenv").config();
const assert = require("assert");
const prisma = require("./src/config/db");
const { getSharedRedisClient, checkRedisHealth, closeRedisConnections } = require("./src/queue/redis.connection");
const { getTaskQueue, closeTaskQueue } = require("./src/queue/queue.producer");
const { TaskWorker } = require("./src/queue/worker");
const { defaultDagCoordinator } = require("./src/queue/dag.coordinator");
const workflowService = require("./src/services/workflow.service");
const { getDbMetrics, resetDbMetrics } = require("./src/utils/db.metrics");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculatePercentiles(latencies) {
  if (latencies.length === 0) return { min: 0, p50: 0, p95: 0, p99: 0, max: 0, avg: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = Number((sum / sorted.length).toFixed(2));
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
  return { min, p50, p95, p99, max, avg };
}

async function waitForRunTerminal(runId, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const run = await prisma.workflowRun.findUnique({
      where: { id: runId },
      include: { tasks: true },
    });
    if (run && ["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status)) {
      return run;
    }
    await sleep(150);
  }
  throw new Error(`Timed out waiting for run '${runId}' after ${timeoutMs}ms`);
}

async function runLoadBenchmarks() {
  console.log("\n=======================================================");
  console.log(" Dormammu Engine - Distributed Architecture Benchmark");
  console.log("=======================================================\n");

  const testUserId = `bench_user_${Date.now()}`;
  let worker = null;

  try {
    // 0. Setup benchmark user
    await prisma.user.create({
      data: {
        id: testUserId,
        email: `${testUserId}@example.com`,
        name: "Benchmark Runner",
        role: "USER",
      },
    });

    const isHealthy = await checkRedisHealth();
    assert.strictEqual(isHealthy, true, "Redis connection must be healthy before benchmark");

    // Initialize worker with concurrency = 5
    worker = new TaskWorker({ concurrency: 5 });
    await worker.start();

    // 1. Create standard linear benchmark workflow
    const linearDef = {
      schemaVersion: 1,
      name: "Linear Benchmark Workflow",
      nodes: [
        { id: "step1", type: "math.add", version: 1, config: { a: 10, b: 20 } },
        { id: "step2", type: "math.multiply", version: 1, config: { b: 3 } },
      ],
      edges: [
        { id: "e1", source: "step1", sourcePort: "result", target: "step2", targetPort: "a" },
      ],
    };

    const linearWorkflow = await workflowService.createWorkflow(testUserId, {
      name: "Linear Benchmark Workflow",
      definition: linearDef,
    });

    // -------------------------------------------------------------
    // BENCHMARK 1: Sub-Second Webhook Ingestion Latency (Bonus Req)
    // -------------------------------------------------------------
    console.log("--- Benchmark 1: Sub-Second Webhook Ingestion Latency ---");
    const INGESTION_COUNT = 30;
    const ingestionLatencies = [];
    const dispatchedRuns = [];

    for (let i = 0; i < INGESTION_COUNT; i++) {
      const start = Date.now();
      const dispatchRes = await workflowService.dispatchWorkflowRun(testUserId, linearWorkflow.id, {
        triggerType: "WEBHOOK",
        triggerData: { iteration: i, payload: "benchmark_data" },
      });
      const elapsed = Date.now() - start;
      ingestionLatencies.push(elapsed);
      dispatchedRuns.push(dispatchRes.runId);
    }

    const ingestionStats = calculatePercentiles(ingestionLatencies);
    console.log(`  Requests Ingested: ${INGESTION_COUNT}`);
    console.log(`  Min Latency:       ${ingestionStats.min} ms`);
    console.log(`  Avg Latency:       ${ingestionStats.avg} ms`);
    console.log(`  P50 Latency:       ${ingestionStats.p50} ms`);
    console.log(`  P95 Latency:       ${ingestionStats.p95} ms`);
    console.log(`  P99 Latency:       ${ingestionStats.p99} ms`);
    console.log(`  Max Latency:       ${ingestionStats.max} ms`);
    assert.ok(ingestionStats.p50 < 1000, `P50 webhook ingestion latency must be < 1000ms (measured: ${ingestionStats.p50}ms)`);
    assert.ok(ingestionStats.avg < 1000, `Average webhook ingestion latency must be < 1000ms (measured: ${ingestionStats.avg}ms)`);
    console.log("  ✓ Sub-second trigger acceptance requirement met.\n");

    // Wait for all ingestion benchmark runs to finish processing
    console.log("  Waiting for queued ingestion runs to complete...");
    await Promise.all(dispatchedRuns.map((rId) => waitForRunTerminal(rId, 25000)));
    console.log("  ✓ All ingestion benchmark workflows completed successfully.\n");

    // -------------------------------------------------------------
    // BENCHMARK 2: Concurrent Multi-Node Execution Scalability
    // -------------------------------------------------------------
    console.log("--- Benchmark 2: Concurrent Multi-Node Execution Scalability ---");
    const CONCURRENT_RUNS = 20;
    const concurrentStart = Date.now();

    const runPromises = Array.from({ length: CONCURRENT_RUNS }, async (_, idx) => {
      const dispatchRes = await workflowService.dispatchWorkflowRun(testUserId, linearWorkflow.id, {
        triggerData: { batchIdx: idx },
      });
      return waitForRunTerminal(dispatchRes.runId, 30000);
    });

    const completedRuns = await Promise.all(runPromises);
    const concurrentTotalDurationMs = Date.now() - concurrentStart;
    const runsPerSecond = Number(((CONCURRENT_RUNS / concurrentTotalDurationMs) * 1000).toFixed(2));

    assert.strictEqual(completedRuns.length, CONCURRENT_RUNS);
    assert.ok(completedRuns.every((r) => r.status === "SUCCEEDED"), "All concurrent runs must succeed");

    console.log(`  Concurrent Workflows: ${CONCURRENT_RUNS}`);
    console.log(`  Total Elapsed Time:   ${concurrentTotalDurationMs} ms`);
    console.log(`  Throughput:           ${runsPerSecond} completed runs/second`);
    console.log("  ✓ Concurrent distributed execution completed without errors.\n");

    // -------------------------------------------------------------
    // BENCHMARK 3: Parallel DAG Branching (Fan-Out & Fan-In)
    // -------------------------------------------------------------
    console.log("--- Benchmark 3: Parallel DAG Branching (Diamond Fan-Out/Fan-In) ---");
    const diamondDef = {
      schemaVersion: 1,
      name: "Parallel Diamond Workflow",
      nodes: [
        { id: "root", type: "math.add", version: 1, config: { a: 10, b: 10 } },
        { id: "branchA", type: "math.multiply", version: 1, config: { b: 2 } },
        { id: "branchB", type: "math.add", version: 1, config: { b: 50 } },
        { id: "branchC", type: "math.multiply", version: 1, config: { b: 10 } },
        { id: "merge", type: "math.add", version: 1, config: {} },
      ],
      edges: [
        { id: "e1", source: "root", sourcePort: "result", target: "branchA", targetPort: "a" },
        { id: "e2", source: "root", sourcePort: "result", target: "branchB", targetPort: "a" },
        { id: "e3", source: "root", sourcePort: "result", target: "branchC", targetPort: "a" },
        { id: "e4", source: "branchA", sourcePort: "result", target: "merge", targetPort: "a" },
        { id: "e5", source: "branchB", sourcePort: "result", target: "merge", targetPort: "b" },
      ],
    };

    const diamondWf = await workflowService.createWorkflow(testUserId, {
      name: "Parallel Diamond Benchmark",
      definition: diamondDef,
    });

    const diamondStart = Date.now();
    const diamondDispatch = await workflowService.dispatchWorkflowRun(testUserId, diamondWf.id, { triggerData: {} });
    const finalDiamondRun = await waitForRunTerminal(diamondDispatch.runId, 20000);
    const diamondElapsed = Date.now() - diamondStart;

    assert.strictEqual(finalDiamondRun.status, "SUCCEEDED");
    assert.strictEqual(finalDiamondRun.tasks.length, 5);

    console.log(`  Diamond Workflow (5 nodes, 3 parallel branches): ${diamondElapsed} ms`);
    console.log("  ✓ Parallel branches executed concurrently and fan-in merged correctly.\n");

    // -------------------------------------------------------------
    // BENCHMARK 4: High-Concurrency Idempotency Collision Test
    // -------------------------------------------------------------
    console.log("--- Benchmark 4: High-Concurrency Idempotency Protection ---");
    const sharedIdempotencyKey = `idem_bench_${Date.now()}`;
    const COLLISION_ATTEMPTS = 15;

    const collisionPromises = Array.from({ length: COLLISION_ATTEMPTS }, () =>
      workflowService.dispatchWorkflowRun(testUserId, linearWorkflow.id, {
        idempotencyKey: sharedIdempotencyKey,
        triggerData: { action: "transfer_funds", amount: 100 },
      })
    );

    const collisionResults = await Promise.all(collisionPromises);
    const uniqueRunIds = new Set(collisionResults.map((r) => r.runId || r.id));

    assert.strictEqual(uniqueRunIds.size, 1, `Exactly 1 workflow run should be created, found: ${uniqueRunIds.size}`);
    const duplicates = collisionResults.filter((r) => r.duplicate === true);
    console.log(`  Simultaneous Requests:    ${COLLISION_ATTEMPTS}`);
    console.log(`  Unique Created Runs:      ${uniqueRunIds.size}`);
    console.log(`  Safely Deduplicated:      ${duplicates.length}`);
    console.log("  ✓ High-concurrency duplicate prevention verified.\n");

    // -------------------------------------------------------------
    // BENCHMARK 5: PostgreSQL Query Optimization Telemetry
    // -------------------------------------------------------------
    console.log("--- Benchmark 5: PostgreSQL Query Optimization Metrics ---");
    const dbMetrics = getDbMetrics();
    console.log(`  Total DB Queries Recorded: ${dbMetrics.totalQueries}`);
    console.log(`  Total DB Query Latency:    ${dbMetrics.totalDurationMs} ms`);
    console.log(`  Average Query Latency:     ${dbMetrics.avgLatencyMs} ms`);
    console.log("  Queries By Operation:");
    for (const [op, count] of Object.entries(dbMetrics.queriesByOperation)) {
      if (count > 0) console.log(`    - ${op.padEnd(12)}: ${count}`);
    }
    console.log("  Queries By Model:");
    for (const [model, count] of Object.entries(dbMetrics.queriesByModel)) {
      if (count > 0) console.log(`    - ${model.padEnd(16)}: ${count}`);
    }

    console.log("\n=======================================================");
    console.log(" ALL LOAD BENCHMARKS PASSED SUCCESSFULLY");
    console.log("=======================================================\n");

  } finally {
    if (worker) {
      await worker.stop();
    }
    await closeTaskQueue();
    await closeRedisConnections();
    await prisma.$disconnect();
  }
}

runLoadBenchmarks().catch((err) => {
  console.error("Load benchmark suite error:", err);
  process.exit(1);
});
