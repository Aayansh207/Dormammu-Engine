/**
 * Node: utility.datetime
 * Provides current timestamp or formatted datetime string
 */

const { defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "utility.datetime",
  version: 1,
  category: "utility",
  label: "Date / Time",
  description: "Outputs current timestamp in ISO or UNIX epoch format",
  inputs: {},
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.STRING, description: "Current ISO date string" }),
    timestamp: defineOutputPort({ name: "timestamp", type: PortTypes.NUMBER, description: "Current epoch timestamp ms" }),
  },
  configSchema: {
    format: {
      type: "select",
      required: false,
      default: "iso",
      options: ["iso", "utc", "epoch_ms", "epoch_s"],
      description: "Output string format",
    },
  },
  validateConfig: (config = {}) => {
    if (config.format) {
      const valid = ["iso", "utc", "epoch_ms", "epoch_s"];
      if (!valid.includes(config.format)) {
        return { valid: false, errors: [`Config 'format' must be one of: ${valid.join(", ")}`], field: "config.format" };
      }
    }
    return { valid: true };
  },
  capabilities: { pure: false, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const now = new Date();
    const format = (node.config && node.config.format) || "iso";

    let outputStr;
    if (format === "utc") {
      outputStr = now.toUTCString();
    } else if (format === "epoch_s") {
      outputStr = String(Math.floor(now.getTime() / 1000));
    } else if (format === "epoch_ms") {
      outputStr = String(now.getTime());
    } else {
      outputStr = now.toISOString();
    }

    return {
      output: outputStr,
      timestamp: now.getTime(),
    };
  },
};
