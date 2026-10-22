/**
 * Node: math.power
 * Computes base ^ exponent
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.power",
  version: "1.0.0",
  category: "math",
  label: "Power",
  description: "Raises base to the specified exponent (base ^ exponent)",
  inputs: {
    base: defineInputPort({ name: "base", type: PortTypes.NUMBER, required: true, description: "Base number" }),
    exponent: defineInputPort({ name: "exponent", type: PortTypes.NUMBER, required: true, description: "Exponent" }),
  },
  outputs: {
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Power result" }),
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs) => {
    return { result: Math.pow(Number(inputs.base), Number(inputs.exponent)) };
  },
};
