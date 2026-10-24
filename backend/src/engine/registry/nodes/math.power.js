/**
 * Node: math.power
 * Computes base ^ exponent
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.power",
  version: 1,
  category: "mathematical",
  label: "Power",
  description: "Raises base to the specified exponent (base ^ exponent or input ^ exponent)",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.NUMBER, required: false, description: "Base number" }),
    base: defineInputPort({ name: "base", type: PortTypes.NUMBER, required: false, description: "Base number (alias)" }),
    exponent: defineInputPort({ name: "exponent", type: PortTypes.NUMBER, required: false, description: "Exponent" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Power result" }),
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Power result (alias)" }),
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
    const rawBase = inputs.input !== undefined ? inputs.input : inputs.base;
    const exponent = inputs.exponent !== undefined
      ? inputs.exponent
      : (node.config && node.config.exponent !== undefined ? node.config.exponent : 2);

    const res = Math.pow(Number(rawBase || 0), Number(exponent || 0));
    return { output: res, result: res };
  },
};
