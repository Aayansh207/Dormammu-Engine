/**
 * Node: math.abs
 * Computes absolute value
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.abs",
  version: "1.0.0",
  category: "math",
  label: "Absolute Value",
  description: "Computes the absolute value of a number",
  inputs: {
    value: defineInputPort({ name: "value", type: PortTypes.NUMBER, required: true, description: "Number" }),
  },
  outputs: {
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Absolute value" }),
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs) => {
    return { result: Math.abs(Number(inputs.value)) };
  },
};
