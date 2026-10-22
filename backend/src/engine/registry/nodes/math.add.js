/**
 * Node: math.add
 * Computes a + b (or input + addend)
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.add",
  version: 1,
  category: "mathematical",
  label: "Add",
  description: "Computes the sum of numbers (a + b or input + addend)",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.NUMBER, required: false, description: "First number" }),
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: false, description: "First number (a)" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: false, description: "Second number (b)" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Sum result" }),
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Sum result (alias)" }),
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
    const rawVal = inputs.input !== undefined ? inputs.input : inputs.a;
    const addend = inputs.b !== undefined
      ? inputs.b
      : (node.config && node.config.addend !== undefined ? node.config.addend : 0);

    const sum = Number(rawVal || 0) + Number(addend || 0);
    return { output: sum, result: sum };
  },
};
