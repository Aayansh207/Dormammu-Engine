/**
 * Node: math.abs
 * Computes absolute value of a number (|x|).
 * Input: single 'input' port.
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.abs",
  version: 1,
  category: "mathematical",
  label: "Absolute Value",
  description: "Computes the absolute value of a number (|x|)",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.NUMBER, required: false, description: "Number to evaluate" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Absolute value (|x|)" }),
  },
  configSchema: {},
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs) => {
    const raw = inputs.input !== undefined ? inputs.input : inputs.value;
    const absVal = Math.abs(Number(raw || 0));
    return { output: absVal };
  },
};
