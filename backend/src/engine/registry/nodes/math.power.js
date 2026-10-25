/**
 * Node: math.power
 * Computes base ^ exponent.
 * Inputs: base (base number), exponent (exponent power, optional with config fallback).
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.power",
  version: 1,
  category: "mathematical",
  label: "Power",
  description: "Raises base to the specified exponent (base ^ exponent)",
  inputs: {
    base: defineInputPort({ name: "base", type: PortTypes.NUMBER, required: false, description: "Base number" }),
    exponent: defineInputPort({ name: "exponent", type: PortTypes.NUMBER, required: false, description: "Exponent (optional, uses exponent config if not connected)" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Power result (base ^ exponent)" }),
  },
  configSchema: {
    exponent: {
      type: "number",
      required: false,
      default: 2,
      description: "Default exponent if port 'exponent' is not connected",
    },
  },
  validateConfig: (config = {}) => {
    if (config.exponent !== undefined) {
      if (typeof config.exponent !== "number" || !Number.isFinite(config.exponent)) {
        return { valid: false, errors: ["Exponent must be a finite number"], field: "config.exponent" };
      }
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const rawBase = inputs.base !== undefined ? inputs.base : inputs.input;
    const exponent = inputs.exponent !== undefined
      ? inputs.exponent
      : (node.config && node.config.exponent !== undefined ? node.config.exponent : 2);

    const res = Math.pow(Number(rawBase || 0), Number(exponent || 0));
    return { output: res };
  },
};
