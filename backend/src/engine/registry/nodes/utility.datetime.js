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
  description: "Outputs current timestamp in ISO or UNIX format",
  inputs: {},
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.STRING, description: "Current ISO date string" }),
    timestamp: defineOutputPort({ name: "timestamp", type: PortTypes.NUMBER, description: "Current epoch timestamp ms" }),
  },
  configSchema: {},
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: false, sideEffects: false, retryable: true },
  handler: async () => {
    const now = new Date();
    return {
      output: now.toISOString(),
      timestamp: now.getTime(),
    };
  },
};
