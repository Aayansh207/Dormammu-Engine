/**
 * Node: math.add
 * Computes a + b
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.add",
  version: "1.0.0",
  category: "math",
  label: "Add",
  description: "Computes the sum of two numbers (a + b)",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: true, description: "First number" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: true, description: "Second number" }),
  },
  outputs: {
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Sum result" }),
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs) => {
    return { result: Number(inputs.a) + Number(inputs.b) };
  },
};
