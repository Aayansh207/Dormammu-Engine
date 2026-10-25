/**
 * Node: math.max
 * Computes maximum of two numbers max(a, b).
 * Inputs: a (first number), b (second number, optional with compareValue config fallback).
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.max",
  version: 1,
  category: "mathematical",
  label: "Maximum",
  description: "Returns the greater of two numbers (max(a, b))",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: false, description: "First number" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: false, description: "Second number (optional, uses compareValue config if not connected)" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Greater of a and b" }),
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
    const valA = inputs.a !== undefined ? inputs.a : inputs.input;
    const compare = inputs.b !== undefined
      ? inputs.b
      : (node.config && node.config.compareValue !== undefined ? node.config.compareValue : 0);

    const maxVal = Math.max(Number(valA || 0), Number(compare || 0));
    return { output: maxVal };
  },
};
