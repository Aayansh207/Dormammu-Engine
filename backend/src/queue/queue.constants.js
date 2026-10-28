/**
 * Dormammu Engine - Queue Constants & Identifiers
 */

module.exports = {
  QUEUES: {
    WORKFLOW_TASKS: "dormammu-workflow-tasks",
  },
  JOB_TYPES: {
    EXECUTE_NODE: "execute_node_task",
    RECONCILE_RUN: "reconcile_workflow_run",
  },
  CHANNELS: {
    SSE_EVENTS: "dormammu:sse:events",
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
