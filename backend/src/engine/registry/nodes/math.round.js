/**
 * Node: math.round
 * Rounds a number to a specified number of decimal places (default: 0)
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.round",
  version: "1.0.0",
  category: "math",
  label: "Round",
  description: "Rounds a number to specified decimal places",
  inputs: {
    value: defineInputPort({ name: "value", type: PortTypes.NUMBER, required: true, description: "Number to round" }),
  },
  outputs: {
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Rounded result" }),
  },
  validateConfig: (config) => {
    if (config && config.decimals !== undefined) {
      if (typeof config.decimals !== "number" || config.decimals < 0) {
        return { valid: false, errors: ["Config 'decimals' must be a non-negative number"] };
      }
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const decimals = (node.config && typeof node.config.decimals === "number") ? node.config.decimals : 0;
    const factor = Math.pow(10, decimals);
    return { result: Math.round(Number(inputs.value) * factor) / factor };
  },
};
