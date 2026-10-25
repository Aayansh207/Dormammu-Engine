/**
 * Node: output.log
 * Writes diagnostic message to execution log and passes data through.
 * Input: single 'input' port.
 * Output: single 'output' port (passes input through).
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
      description: "Data to log and pass through downstream",
    }),
  },
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.ANY,
      description: "Forwarded data",
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

    if (context && context.logger && typeof context.logger[level] === "function") {
      context.logger[level](`[Node ${node.id}]`, rawVal);
    }

    return { output: rawVal };
  },
};
