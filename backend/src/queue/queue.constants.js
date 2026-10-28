/**
 * Dormammu Engine - Queue Constants & Identifiers
 */

module.exports = {
  QUEUES: {
    WORKFLOW_TASKS: "dormammu-workflow-tasks",
    WORKFLOW_DLQ: "dormammu-workflow-dlq",
  },
  JOB_TYPES: {
    EXECUTE_NODE: "execute_node_task",
    RECONCILE_RUN: "reconcile_workflow_run",
    DEAD_LETTER_TASK: "dead_letter_task",
  },
  CHANNELS: {
    SSE_EVENTS: "dormammu:sse:events",
  },
  REDIS_KEYS: {
    WORKER_HEARTBEAT_PREFIX: "dormammu:workers:",
    ACTIVE_RUN_LOCK_PREFIX: "dormammu:locks:run:",
    PLAN_CACHE_PREFIX: "dormammu:cache:plan:",
    METRICS_PREFIX: "dormammu:metrics:",
  },
  JOB_SCHEMA_VERSION: 1,
  TASK_STATUS: {
    PENDING: "PENDING",
    READY: "READY",
    RUNNING: "RUNNING",
    SUCCEEDED: "SUCCEEDED",
    FAILED: "FAILED",
    BLOCKED: "BLOCKED",
    SKIPPED: "SKIPPED",
    CANCELLED: "CANCELLED",
  },
  RUN_STATUS: {
    PENDING: "PENDING",
    RUNNING: "RUNNING",
    SUCCEEDED: "SUCCEEDED",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
  },
};
