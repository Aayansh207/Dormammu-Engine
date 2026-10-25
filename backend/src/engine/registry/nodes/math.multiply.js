/**
 * Node: math.multiply
 * Multiplies two numbers (a * b).
 * Inputs: a (multiplicand), b (multiplier, optional with factor config fallback).
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.multiply",
  version: 1,
  category: "mathematical",
  label: "Multiply",
  description: "Computes the product of two numbers (a * b)",
  inputs: {
    a: defineInputPort({
      name: "a",
      type: PortTypes.NUMBER,
      required: false,
      description: "Multiplicand",
    }),
    b: defineInputPort({
      name: "b",
      type: PortTypes.NUMBER,
      required: false,
      description: "Multiplier (optional, uses factor if not connected)",
    }),
  },
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.NUMBER,
      description: "Product result (a * b)",
    }),
  },
  configSchema: {
    factor: {
      type: "number",
      required: false,
      default: 1,
      description: "Multiplier factor if port 'b' is not connected",
    },
  },
  validateConfig: (config = {}) => {
    if (config.factor !== undefined) {
      if (typeof config.factor !== "number" || !Number.isFinite(config.factor)) {
        return {
          valid: false,
          errors: ["Factor must be a finite number"],
          field: "config.factor",
        };
      }
    }
    return { valid: true };
  },
  capabilities: {
    pure: true,
    sideEffects: false,
    retryable: true,
  },
  handler: async (inputs, node) => {
    const valA = inputs.a !== undefined ? inputs.a : inputs.input;
    const factor = inputs.b !== undefined
      ? inputs.b
      : (node.config && node.config.factor !== undefined ? node.config.factor : 1);

    const prod = Number(valA || 0) * Number(factor !== undefined ? factor : 1);
    return { output: prod };
  },
};
