/**
 * Node: math.multiply
 * Computes a * b
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.multiply",
  version: "1.0.0",
  category: "math",
  label: "Multiply",
  description: "Computes the product of two numbers (a * b)",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: true, description: "Multiplicand" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: true, description: "Multiplier" }),
  },
  outputs: {
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Product result" }),
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs) => {
    return { result: Number(inputs.a) * Number(inputs.b) };
  },
};
