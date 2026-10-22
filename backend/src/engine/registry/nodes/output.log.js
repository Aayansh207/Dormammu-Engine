/**
 * Node: output.log
 * Writes diagnostic message to safe execution logger
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "output.log",
  version: 1,
  category: "output",
  label: "Log Diagnostic",
  description: "Logs diagnostic messages safely during execution and passes data through",
  inputs: {
    input: defineInputPort({
      name: "input",
      type: PortTypes.ANY,
      required: false,
      description: "Data to log",
    }),
    message: defineInputPort({
      name: "message",
      type: PortTypes.ANY,
      required: false,
      description: "Message or data to log (alias)",
    }),
  },
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.ANY,
      description: "Forwarded logged data",
    }),
    logged: defineOutputPort({
      name: "logged",
      type: PortTypes.BOOLEAN,
      description: "True if logged successfully",
    }),
  },
  configSchema: {
    level: {
      type: "select",
      required: false,
      default: "info",
      options: ["info", "warn", "error", "debug"],
      description: "Log severity level",
    },
  },
  validateConfig: (config) => {
    if (config && config.level) {
      const validLevels = ["info", "warn", "error", "debug"];
      if (!validLevels.includes(config.level)) {
        return { valid: false, errors: [`Config 'level' must be one of: ${validLevels.join(", ")}`], field: "config.level" };
      }
    }
    return { valid: true };
  },
  capabilities: { pure: false, sideEffects: true, retryable: true },
  handler: async (inputs, node, context) => {
    const rawVal = inputs.input !== undefined ? inputs.input : inputs.message;
    const level = (node.config && node.config.level) || "info";
    const logger = context && context.logger ? context.logger : console;
    const logFn = typeof logger[level] === "function" ? logger[level] : logger.info;

    const nodeLabel = (node && (node.name || node.id)) || "node";
    const msgStr = typeof rawVal === "object" ? JSON.stringify(rawVal) : String(rawVal ?? "");
    logFn(`[${nodeLabel}] ${msgStr}`, rawVal);
    return {
      output: rawVal,
      logged: true,
    };
  },
};
