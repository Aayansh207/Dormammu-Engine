/**
 * Node: math.multiply
 * Multiplies a numeric input by a factor (or a * b)
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.multiply",
  version: 1,
  category: "mathematical",
  label: "Multiply",
  description: "Multiplies a numeric input by a factor or computes product (a * b)",
  inputs: {
    input: defineInputPort({
      name: "input",
      type: PortTypes.NUMBER,
      required: false,
      description: "Numeric value to multiply",
    }),
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
      description: "Multiplier",
    }),
  },
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.NUMBER,
      description: "Product result",
    }),
    result: defineOutputPort({
      name: "result",
      type: PortTypes.NUMBER,
      description: "Product result alias",
    }),
  },
  configSchema: {
    factor: {
      type: "number",
      required: false,
      default: 1,
      description: "Multiplier factor if not connecting a second port",
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
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const rawVal = inputs.input !== undefined ? inputs.input : inputs.a;
    const factor = inputs.b !== undefined
      ? inputs.b
      : (node.config && node.config.factor !== undefined ? node.config.factor : 1);

    const val = rawVal !== undefined ? Number(rawVal) : 0;
    const mult = Number(factor);
    const product = val * mult;

    return {
      output: product,
      result: product,
    };
  },
};
