/**
 * Dormammu Engine - Queue Producer
 * Dispatches node tasks to BullMQ with deduplication, priority, and delayed scheduling.
 */

const { Queue } = require("bullmq");
const { getSharedRedisClient } = require("./redis.connection");
const { QUEUES, JOB_TYPES, JOB_SCHEMA_VERSION } = require("./queue.constants");

let taskQueue = null;

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
 * Retrieves aggregate job metrics from Redis.
 * @returns {Promise<{ waiting: number, active: number, delayed: number, failed: number, completed: number }>}
 */
async function getQueueMetrics() {
  const queue = getTaskQueue();
  const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed", "completed");
  return counts;
}

/**
 * Closes the BullMQ queue cleanly.
 */
async function closeTaskQueue() {
  if (taskQueue) {
    await taskQueue.close();
    taskQueue = null;
  }
}

module.exports = {
  getTaskQueue,
  enqueueTaskJob,
  enqueueBulkTaskJobs,
  getQueueMetrics,
  closeTaskQueue,
};
