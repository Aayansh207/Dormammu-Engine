/**
 * Node: math.max
 * Computes maximum of numbers
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.max",
  version: 1,
  category: "mathematical",
  label: "Maximum",
  description: "Returns the greater of two numbers (max(a, b) or max(input, compareValue))",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.NUMBER, required: false, description: "First number" }),
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: false, description: "First number (alias)" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: false, description: "Second number" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Maximum result" }),
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Maximum result (alias)" }),
  },
  configSchema: {
    compareValue: {
      type: "number",
      required: false,
      default: 0,
      description: "Default number to compare against if port 'b' is not connected",
    },
  },
  validateConfig: (config = {}) => {
    if (config.compareValue !== undefined) {
      if (typeof config.compareValue !== "number" || !Number.isFinite(config.compareValue)) {
        return { valid: false, errors: ["compareValue must be a finite number"], field: "config.compareValue" };
      }
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const rawVal = inputs.input !== undefined ? inputs.input : inputs.a;
    const compare = inputs.b !== undefined
      ? inputs.b
      : (node.config && node.config.compareValue !== undefined ? node.config.compareValue : 0);

    const max = Math.max(Number(rawVal || 0), Number(compare || 0));
    return { output: max, result: max };
  },
};
