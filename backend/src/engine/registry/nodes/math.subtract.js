/**
 * Node: math.subtract
 * Computes a - b (or input - subtrahend)
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.subtract",
  version: 1,
  category: "mathematical",
  label: "Subtract",
  description: "Computes the difference between numbers (a - b or input - subtrahend)",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.NUMBER, required: false, description: "Minuend" }),
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: false, description: "Minuend (a)" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: false, description: "Subtrahend (b)" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Difference result" }),
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Difference result (alias)" }),
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
    const rawVal = inputs.input !== undefined ? inputs.input : inputs.a;
    const sub = inputs.b !== undefined
      ? inputs.b
      : (node.config && node.config.subtrahend !== undefined ? node.config.subtrahend : 0);

    const diff = Number(rawVal || 0) - Number(sub || 0);
    return { output: diff, result: diff };
  },
};
