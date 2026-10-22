/**
 * Node: output.log
 * Writes diagnostic message to safe execution logger
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "output.log",
  version: "1.0.0",
  category: "output",
  label: "Log Diagnostic",
  description: "Logs diagnostic messages safely during execution",
  inputs: {
    message: defineInputPort({ name: "message", type: PortTypes.ANY, required: true, description: "Message or data to log" }),
  },
  outputs: {
    logged: defineOutputPort({ name: "logged", type: PortTypes.BOOLEAN, description: "True if logged successfully" }),
  },
  validateConfig: (config) => {
    if (config && config.level) {
      const validLevels = ["info", "warn", "error", "debug"];
      if (!validLevels.includes(config.level)) {
        return { valid: false, errors: [`Config 'level' must be one of: ${validLevels.join(", ")}`] };
      }
    }
    return { valid: true };
  },
  capabilities: { pure: false, sideEffects: true, retryable: true },
  handler: async (inputs, node, context) => {
    const level = (node.config && node.config.level) || "info";
    const logger = context && context.logger ? context.logger : console;
    const logFn = typeof logger[level] === "function" ? logger[level] : logger.info;

    const nodeLabel = (node && (node.name || node.id)) || "node";
    const msgStr = typeof inputs.message === "object" ? JSON.stringify(inputs.message) : String(inputs.message);
    logFn(`[${nodeLabel}] ${msgStr}`, inputs.message);
    return { logged: true };
  },
};
