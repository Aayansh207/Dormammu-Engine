/**
 * Dormammu Engine - Queue Producer
 * Dispatches node tasks to BullMQ with deduplication, priority, and delayed scheduling.
 */

const { Queue } = require("bullmq");
const { getSharedRedisClient } = require("./redis.connection");
const { QUEUES, JOB_TYPES, JOB_SCHEMA_VERSION } = require("./queue.constants");

let taskQueue = null;
let dlqQueue = null;

/**
 * Returns the singleton BullMQ Queue instance for workflow tasks.
 * @returns {import('bullmq').Queue}
 */
function getTaskQueue() {
  if (!taskQueue) {
    const connection = getSharedRedisClient();
    taskQueue = new Queue(QUEUES.WORKFLOW_TASKS, {
      connection,
      defaultJobOptions: {
        removeOnComplete: {
          count: 500, // Keep last 500 completed jobs in Redis for quick inspection
          age: 3600,  // Or 1 hour
        },
        removeOnFail: {
          count: 500,
          age: 86400, // Keep 24 hours for diagnostics
        },
      },
    });

    taskQueue.on("error", (err) => {
      console.warn(`[BullMQ TaskQueue Error] ${err.message}`);
    });
  }
  return taskQueue;
}

/**
 * Returns the singleton BullMQ Queue instance for Dead-Letter Queue (DLQ).
 * Stores failed tasks whose retries have been exhausted.
 * @returns {import('bullmq').Queue}
 */
function getDlqQueue() {
  if (!dlqQueue) {
    const connection = getSharedRedisClient();
    dlqQueue = new Queue(QUEUES.WORKFLOW_DLQ, {
      connection,
      defaultJobOptions: {
        removeOnComplete: {
          count: 1000,
          age: 7 * 86400, // Retain 7 days for post-mortem analysis
        },
        removeOnFail: {
          count: 1000,
          age: 7 * 86400,
        },
      },
    });

    dlqQueue.on("error", (err) => {
      console.warn(`[BullMQ DLQ Error] ${err.message}`);
    });
  }
  return dlqQueue;
}

/**
 * Enqueues a single node task execution job.
 * @param {Object} options
 * @param {string} options.runId
 * @param {string} options.workflowId
 * @param {string} options.workflowVersionId
 * @param {string} options.nodeId
 * @param {string} options.taskExecutionId
 * @param {number} [options.attempt=1]
 * @param {number} [options.delay=0] - Delay in milliseconds for retries
 * @param {number} [options.priority=0]
 * @returns {Promise<import('bullmq').Job>}
 */
async function enqueueTaskJob({
  runId,
  workflowId,
  workflowVersionId,
  nodeId,
  taskExecutionId,
  attempt = 1,
  delay = 0,
  priority = 0,
}) {
  const queue = getTaskQueue();
  const jobId = `${runId}:${nodeId}:${attempt}`;

  const payload = {
    schemaVersion: JOB_SCHEMA_VERSION,
    runId,
    workflowId,
    workflowVersionId,
    nodeId,
    taskExecutionId,
    attempt,
  };

  const jobOptions = {
    jobId,
    delay: Math.max(0, delay),
    ...(priority ? { priority } : {}),
  };

  return queue.add(JOB_TYPES.EXECUTE_NODE, payload, jobOptions);
}

/**
 * Enqueues a permanently failed task into the Dead-Letter Queue (DLQ).
 * @param {Object} options
 * @returns {Promise<import('bullmq').Job>}
 */
async function enqueueDlqJob({
  runId,
  workflowId,
  workflowVersionId,
  nodeId,
  taskExecutionId,
  attempt,
  error,
  durationMs,
  inputs,
}) {
  const dlq = getDlqQueue();
  const safeRunId = String(runId || "run").replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeNodeId = String(nodeId || "node").replace(/[^a-zA-Z0-9_-]/g, "_");
  const dlqJobId = `dlq_${safeRunId}_${safeNodeId}_${attempt || 1}_${Date.now()}`;

  const dlqPayload = {
    schemaVersion: JOB_SCHEMA_VERSION,
    jobType: JOB_TYPES.DEAD_LETTER_TASK,
    runId,
    workflowId,
    workflowVersionId,
    nodeId,
    taskExecutionId,
    attempt,
    error: error || { message: "Unknown fatal error" },
    durationMs: durationMs || 0,
    inputs: inputs || null,
    deadLetteredAt: new Date().toISOString(),
  };

  return dlq.add(JOB_TYPES.DEAD_LETTER_TASK, dlqPayload, {
    jobId: dlqJobId,
  });
}

/**
 * Enqueues multiple ready node tasks in parallel (bulk).
 * @param {Array<Object>} tasks - Array of enqueueTaskJob options
 * @returns {Promise<Array<import('bullmq').Job>>}
 */
async function enqueueBulkTaskJobs(tasks = []) {
  if (tasks.length === 0) return [];
  const queue = getTaskQueue();

  const jobsData = tasks.map((t) => {
    const attempt = t.attempt || 1;
    const jobId = `${t.runId}:${t.nodeId}:${attempt}`;
    return {
      name: JOB_TYPES.EXECUTE_NODE,
      data: {
        schemaVersion: JOB_SCHEMA_VERSION,
        runId: t.runId,
        workflowId: t.workflowId,
        workflowVersionId: t.workflowVersionId,
        nodeId: t.nodeId,
        taskExecutionId: t.taskExecutionId,
        attempt,
      },
      opts: {
        jobId,
        delay: Math.max(0, t.delay || 0),
        ...(t.priority ? { priority: t.priority } : {}),
      },
    };
  });

  return queue.addBulk(jobsData);
}

/**
 * Retrieves aggregate job metrics from Redis for the primary queue.
 * @returns {Promise<{ waiting: number, active: number, delayed: number, failed: number, completed: number }>}
 */
async function getQueueMetrics() {
  const queue = getTaskQueue();
  const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed", "completed");
  return counts;
}

/**
 * Retrieves aggregate job metrics from Redis for the Dead-Letter Queue.
 * @returns {Promise<{ waiting: number, active: number, delayed: number, failed: number, completed: number }>}
 */
async function getDlqMetrics() {
  const dlq = getDlqQueue();
  const counts = await dlq.getJobCounts("waiting", "active", "delayed", "failed", "completed");
  const total =
    (counts.waiting || 0) +
    (counts.active || 0) +
    (counts.delayed || 0) +
    (counts.failed || 0) +
    (counts.completed || 0);
  return {
    count: total,
    total,
    ...counts,
  };
}

/**
 * Lists dead-letter jobs for inspection and troubleshooting.
 * @param {number} [start=0]
 * @param {number} [end=49]
 * @returns {Promise<Array<Object>>}
 */
async function getDlqJobs(startOrLimit = 50, maybeEnd = null) {
  const dlq = getDlqQueue();
  let start = 0;
  let end = 49;
  if (maybeEnd !== null) {
    start = Number(startOrLimit) || 0;
    end = Number(maybeEnd) || 49;
  } else if (typeof startOrLimit === "number") {
    start = 0;
    end = Math.max(0, startOrLimit - 1);
  }
  const jobs = await dlq.getJobs(["waiting", "active", "failed", "completed", "delayed"], start, end);
  return jobs.map((j) => ({
    id: j.id,
    name: j.name,
    data: j.data,
    timestamp: j.timestamp,
    processedOn: j.processedOn,
    finishedOn: j.finishedOn,
    failedReason: j.failedReason,
  }));
}

/**
 * Replays a job from the Dead-Letter Queue back into the main workflow task queue.
 * @param {string} dlqJobId
 * @returns {Promise<{ replayed: boolean, newJobId: string }>}
 */
async function retryDlqJob(dlqJobId) {
  const dlq = getDlqQueue();
  const job = await dlq.getJob(dlqJobId);
  if (!job) {
    const err = new Error(`Dead-letter job '${dlqJobId}' not found`);
    err.statusCode = 404;
    throw err;
  }

  const { runId, workflowId, workflowVersionId, nodeId, taskExecutionId, attempt } = job.data;

  // Re-enqueue with next attempt number into main workflow tasks queue
  const newJob = await enqueueTaskJob({
    runId,
    workflowId,
    workflowVersionId,
    nodeId,
    taskExecutionId,
    attempt: (attempt || 1) + 1,
    delay: 0,
  });

  // Remove from DLQ
  await job.remove().catch(() => {});

  return {
    success: true,
    replayed: true,
    replayedJobId: newJob.id,
    newJobId: newJob.id,
    dlqJobId,
  };
}

/**
 * Closes all BullMQ queues cleanly.
 */
async function closeTaskQueue() {
  const promises = [];
  if (taskQueue) {
    promises.push(taskQueue.close());
    taskQueue = null;
  }
  if (dlqQueue) {
    promises.push(dlqQueue.close());
    dlqQueue = null;
  }
  await Promise.all(promises);
}

module.exports = {
  getTaskQueue,
  getDlqQueue,
  enqueueTaskJob,
  enqueueDlqJob,
  enqueueBulkTaskJobs,
  getQueueMetrics,
  getDlqMetrics,
  getDlqJobs,
  retryDlqJob,
  closeTaskQueue,
};
