/**
 * Node: math.max
 * Computes maximum of two numbers
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.max",
  version: "1.0.0",
  category: "math",
  label: "Maximum",
  description: "Returns the greater of two numbers (max(a, b))",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: true, description: "First number" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: true, description: "Second number" }),
  },
  outputs: {
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Maximum result" }),
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs) => {
    return { result: Math.max(Number(inputs.a), Number(inputs.b)) };
  },
};
