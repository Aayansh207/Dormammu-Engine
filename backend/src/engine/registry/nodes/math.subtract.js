/**
 * Node: math.subtract
 * Computes difference (a - b).
 * Inputs: a (minuend), b (subtrahend, optional with config fallback).
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.subtract",
  version: 1,
  category: "mathematical",
  label: "Subtract",
  description: "Computes the difference between two numbers (a - b)",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: false, description: "Minuend (number to subtract from)" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: false, description: "Subtrahend (number to subtract)" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Difference result (a - b)" }),
  },
  configSchema: {
    subtrahend: {
      type: "number",
      required: false,
      default: 0,
      description: "Default number to subtract if port 'b' is not connected",
    },
  },
  validateConfig: (config = {}) => {
    if (config.subtrahend !== undefined) {
      if (typeof config.subtrahend !== "number" || !Number.isFinite(config.subtrahend)) {
        return { valid: false, errors: ["Subtrahend must be a finite number"], field: "config.subtrahend" };
      }
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const valA = inputs.a !== undefined ? inputs.a : inputs.input;
    const sub = inputs.b !== undefined
      ? inputs.b
      : (node.config && node.config.subtrahend !== undefined ? node.config.subtrahend : 0);

    const diff = Number(valA || 0) - Number(sub || 0);
    return { output: diff };
  },
};
