/**
 * Node: math.add
 * Computes the sum of numbers (a + b).
 * Inputs: a (first operand), b (second operand, optional with addend config fallback).
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.add",
  version: 1,
  category: "mathematical",
  label: "Add",
  description: "Computes the sum of two numbers (a + b)",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: false, description: "First number" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: false, description: "Second number (optional, uses addend if not connected)" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Sum result (a + b)" }),
  },
  configSchema: {
    addend: {
      type: "number",
      required: false,
      default: 0,
      description: "Default number to add if port 'b' is not connected",
    },
  },
  validateConfig: (config = {}) => {
    if (config.addend !== undefined) {
      if (typeof config.addend !== "number" || !Number.isFinite(config.addend)) {
        return { valid: false, errors: ["Addend must be a finite number"], field: "config.addend" };
      }
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const valA = inputs.a !== undefined ? inputs.a : inputs.input;
    const addend = inputs.b !== undefined
      ? inputs.b
      : (node.config && node.config.addend !== undefined ? node.config.addend : 0);

    const sum = Number(valA || 0) + Number(addend || 0);
    return { output: sum };
  },
};
