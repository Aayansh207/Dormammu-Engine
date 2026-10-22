/**
 * Node: math.subtract
 * Computes a - b
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.subtract",
  version: "1.0.0",
  category: "math",
  label: "Subtract",
  description: "Computes the difference between two numbers (a - b)",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: true, description: "Minuend" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: true, description: "Subtrahend" }),
  },
  outputs: {
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Difference result" }),
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs) => {
    return { result: Number(inputs.a) - Number(inputs.b) };
  },
};
