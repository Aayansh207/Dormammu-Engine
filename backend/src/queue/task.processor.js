/**
 * Dormammu Engine - Generic BullMQ Task Processor
 * Consumes queued node jobs, enforces atomic claiming, loads immutable context,
 * resolves inputs, executes registered handlers, applies retry policies, and triggers DAG coordination.
 */

const prisma = require("../config/db");
const { defaultRegistry } = require("../engine/registry/node.registry");
const { executeNodeRuntime, resolveNodeInputs } = require("../engine/runtime/node.runtime");
const { createExecutionContext, createSafeLogger } = require("../engine/contracts/context");
const { ErrorCodes } = require("../engine/contracts/errors");
const { defaultDagCoordinator, getExecutionPlan } = require("./dag.coordinator");
const { claimTaskExecution } = require("./idempotency.utils");
const { isRetryableError, getRetryPolicy, calculateBackoffDelay } = require("./retry.policy");
const { enqueueTaskJob, enqueueDlqJob } = require("./queue.producer");
const { defaultSseService } = require("../services/sse.service");
const { sanitizePayload } = require("../utils/payload.sanitizer");

/**
 * Main processor function invoked by BullMQ Worker for each job.
 * @param {import('bullmq').Job} job
 * @param {string} workerId
 * @returns {Promise<Object>}
 */
async function processTaskJob(job, workerId = `worker_${process.pid}`) {
  const {
    runId,
    workflowId,
    workflowVersionId,
    nodeId,
    taskExecutionId,
    attempt = 1,
  } = job.data;

  const startTime = Date.now();

  // 1. Resolve workflow run and version using planCache optimization
  // If plan is already compiled for workflowVersionId, skip fetching full definition JSON
  const isPlanCached = Boolean(workflowVersionId && getExecutionPlan(workflowVersionId, null));

  const run = await prisma.workflowRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      status: true,
      input: true,
      workflowVersionId: true,
      ...(isPlanCached ? {} : { workflowVersion: true }),
    },
  });

  if (!run) {
    console.warn(`[TaskProcessor] Run '${runId}' not found in database. Discarding job.`);
    return { skipped: true, reason: "RUN_NOT_FOUND" };
  }

  if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(run.status)) {
    return { skipped: true, reason: "RUN_ALREADY_TERMINAL" };
  }

  const resolvedVersionId = workflowVersionId || run.workflowVersionId;
  const definition = run.workflowVersion?.definitionJson;
  const plan = getExecutionPlan(resolvedVersionId, definition);
  const node = plan.nodes.get(nodeId);

  if (!node) {
    console.warn(`[TaskProcessor] Node '${nodeId}' not found in workflow plan. Discarding job.`);
    return { skipped: true, reason: "NODE_NOT_IN_PLAN" };
  }

  // 2. Atomic task state claim (protects against concurrent duplicate workers)
  const { claimed, task } = await claimTaskExecution(taskExecutionId, workerId, 30000);
  if (!claimed) {
    if (task && task.status === "SUCCEEDED") {
      // Already successfully executed by another worker or attempt
      return { skipped: true, reason: "TASK_ALREADY_SUCCEEDED", output: task.output };
    }
    if (task && ["SKIPPED", "BLOCKED", "CANCELLED"].includes(task.status)) {
      return { skipped: true, reason: `TASK_${task.status}` };
    }
    console.warn(`[TaskProcessor] Task '${taskExecutionId}' already claimed or running. Skipping duplicate.`);
    return { skipped: true, reason: "TASK_CLAIM_REJECTED" };
  }

  // Emit task running SSE event
  defaultSseService.emitRunEvent(runId, "task:running", {
    runId,
    nodeId,
    nodeName: node.name || nodeId,
    status: "RUNNING",
    attempt,
    startedAt: new Date().toISOString(),
  });

  // 3. Resolve inputs from predecessors or triggerData
  let incomingEdges = plan.incomingEdgesByNode.get(nodeId) || [];
  const nodeOutputsStore = new Map();

  if (incomingEdges.length > 0) {
    const predecessorIds = incomingEdges.map((e) => e.source);
    const predecessorTasks = await prisma.taskExecution.findMany({
      where: {
        runId,
        nodeId: { in: predecessorIds },
      },
      select: { nodeId: true, output: true, status: true },
    });

    for (const pred of predecessorTasks) {
      if (pred.output !== null && pred.output !== undefined) {
        nodeOutputsStore.set(pred.nodeId, pred.output);
      }
    }
  }

  // For entry nodes or nodes using triggerData fallback
  const triggerData = run.input || {};

  // Filter incoming edges to only those whose predecessors actually emitted an output port
  const activeIncomingEdges = incomingEdges.filter((edge) => {
    const predOut = nodeOutputsStore.get(edge.source);
    if (!predOut) return false;
    return (
      predOut[edge.sourcePort] !== undefined ||
      (edge.sourcePort === "output" && predOut["result"] !== undefined) ||
      (edge.sourcePort === "result" && predOut["output"] !== undefined)
    );
  });

  const logger = createSafeLogger(runId, nodeId);
  const taskContext = createExecutionContext({
    runId,
    taskId: `${runId}_${nodeId}_${attempt}`,
    nodeId,
    triggerData,
    logger,
    isDelayedByQueue: node.type === "flow.delay",
  });

  const retryPolicy = getRetryPolicy(node);

  // 4. Execute registered node handler
  try {
    const execResult = await executeNodeRuntime({
      node,
      registry: defaultRegistry,
      nodeOutputsStore,
      incomingEdges: activeIncomingEdges,
      context: taskContext,
    });

    const durationMs = Date.now() - startTime;
    const finishedAt = new Date();

    // 5. Persist task success and attempt in PostgreSQL
    await prisma.$transaction([
      prisma.taskExecution.update({
        where: { id: taskExecutionId },
        data: {
          status: "SUCCEEDED",
          attempts: attempt,
          input: sanitizePayload(execResult.inputs),
          output: sanitizePayload(execResult.outputs),
          error: null,
          durationMs,
          finishedAt,
        },
      }),
      prisma.taskAttempt.create({
        data: {
          taskExecutionId,
          attemptNumber: attempt,
          status: "SUCCEEDED",
          durationMs,
          startedAt: new Date(startTime),
          finishedAt,
        },
      }),
    ]);

    // Emit task succeeded SSE event
    defaultSseService.emitRunEvent(runId, "task:succeeded", {
      runId,
      nodeId,
      nodeName: node.name || nodeId,
      status: "SUCCEEDED",
      attempt,
      inputs: sanitizePayload(execResult.inputs),
      input: sanitizePayload(execResult.inputs),
      outputs: sanitizePayload(execResult.outputs),
      output: sanitizePayload(execResult.outputs),
      durationMs,
      completedAt: finishedAt.toISOString(),
    });

    // 6. Notify DAG Coordinator to evaluate downstream dependencies
    await defaultDagCoordinator.onTaskCompleted({
      runId,
      nodeId,
      outputs: execResult.outputs,
    });

    return {
      success: true,
      nodeId,
      outputs: execResult.outputs,
      durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const finishedAt = new Date();
    const structuredError = err.toJSON
      ? err.toJSON()
      : { code: err.code || ErrorCodes.HANDLER_EXECUTION_FAILED, message: err.message, details: err.details || {} };

    const retryable = isRetryableError(err, node.config);
    const hasRetriesLeft = attempt < retryPolicy.maxAttempts;

    if (retryable && hasRetriesLeft) {
      // Retryable failure: schedule delayed retry via BullMQ
      const delayMs = calculateBackoffDelay(attempt, retryPolicy);

      await prisma.$transaction([
        prisma.taskExecution.update({
          where: { id: taskExecutionId },
          data: {
            status: "READY",
            attempts: attempt,
            claimExpiresAt: null,
            claimedBy: null,
          },
        }),
        prisma.taskAttempt.create({
          data: {
            taskExecutionId,
            attemptNumber: attempt,
            status: "FAILED",
            error: structuredError,
            durationMs,
            startedAt: new Date(startTime),
            finishedAt,
          },
        }),
      ]);

      defaultSseService.emitRunEvent(runId, "task:retry_scheduled", {
        runId,
        nodeId,
        nodeName: node.name || nodeId,
        status: "RETRY_SCHEDULED",
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        error: structuredError,
      });

      // Schedule delayed BullMQ job
      await enqueueTaskJob({
        runId,
        workflowId,
        workflowVersionId,
        nodeId,
        taskExecutionId,
        attempt: attempt + 1,
        delay: delayMs,
      });

      return {
        retried: true,
        attempt,
        nextAttempt: attempt + 1,
        delayMs,
        error: structuredError,
      };
    }

    // Route to Dead-Letter Queue (DLQ)
    let dlqJobId = null;
    try {
      const dlqJob = await enqueueDlqJob({
        runId,
        workflowId,
        workflowVersionId,
        nodeId,
        taskExecutionId,
        attempt,
        error: structuredError,
        durationMs,
        inputs: sanitizePayload(triggerData),
      });
      dlqJobId = dlqJob?.id || null;
    } catch (dlqErr) {
      console.warn(`[TaskProcessor] Dead-letter queue routing warning: ${dlqErr.message}`);
    }

    const finalFailureError = {
      ...structuredError,
      dlqJobId,
      retriesExhausted: attempt >= retryPolicy.maxAttempts,
    };

    // Terminal Failure: retries exhausted or non-retryable error
    await prisma.$transaction([
      prisma.taskExecution.update({
        where: { id: taskExecutionId },
        data: {
          status: "FAILED",
          attempts: attempt,
          error: finalFailureError,
          durationMs,
          finishedAt,
        },
      }),
      prisma.taskAttempt.create({
        data: {
          taskExecutionId,
          attemptNumber: attempt,
          status: "FAILED",
          error: finalFailureError,
          durationMs,
          startedAt: new Date(startTime),
          finishedAt,
        },
      }),
    ]);

    defaultSseService.emitRunEvent(runId, "task:failed", {
      runId,
      nodeId,
      nodeName: node.name || nodeId,
      status: "FAILED",
      attempt,
      error: finalFailureError,
      dlqJobId,
      durationMs,
      completedAt: finishedAt.toISOString(),
    });

    // Notify DAG Coordinator of terminal node failure (triggers fail-fast cascade)
    await defaultDagCoordinator.onTaskFailed({
      runId,
      nodeId,
      error: finalFailureError,
    });

    return {
      failed: true,
      nodeId,
      error: finalFailureError,
      dlqJobId,
    };
  }
}

module.exports = {
  processTaskJob,
};
