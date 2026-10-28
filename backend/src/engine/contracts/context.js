/**
 * Webster Execution Engine - Execution Context Contract
 */

/**
 * Creates a safe logger instance scoped to a task execution.
 * @param {string} runId
 * @param {string} nodeId
 * @param {Array} [logSink=[]] - in-memory buffer to record execution logs safely
 * @returns {Object}
 */
function createSafeLogger(runId, nodeId, logSink = []) {
  return {
    info: (msg, data = {}) => {
      logSink.push({ level: "info", timestamp: new Date().toISOString(), runId, nodeId, message: String(msg), data });
    },
    warn: (msg, data = {}) => {
      logSink.push({ level: "warn", timestamp: new Date().toISOString(), runId, nodeId, message: String(msg), data });
    },
    error: (msg, data = {}) => {
      logSink.push({ level: "error", timestamp: new Date().toISOString(), runId, nodeId, message: String(msg), data });
    },
    debug: (msg, data = {}) => {
      logSink.push({ level: "debug", timestamp: new Date().toISOString(), runId, nodeId, message: String(msg), data });
    },
    getLogs: () => [...logSink],
  };
}

/**
 * Creates an execution context for an isolated node handler.
 * @param {Object} options
 * @param {string} options.runId
 * @param {string} options.taskId
 * @param {string} options.nodeId
 * @param {Object} [options.triggerData={}]
 * @param {AbortSignal} [options.abortSignal]
 * @param {Object} [options.logger]
 * @param {Object} [options.env={}]
 * @returns {Object}
 */
function createExecutionContext({
  runId,
  taskId,
  nodeId,
  triggerData = {},
  abortSignal = null,
  logger = null,
  env = {},
  ...rest
}) {
  const safeLogger = logger || createSafeLogger(runId, nodeId);

  return {
    runId,
    taskId,
    nodeId,
    triggerData,
    abortSignal,
    logger: safeLogger,
    env,
    ...rest,
  };
}

module.exports = {
  createSafeLogger,
  createExecutionContext,
};
