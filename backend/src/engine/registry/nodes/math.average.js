/**
 * Node: math.average
 * Computes average of numbers
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.average",
  version: 1,
  category: "mathematical",
  label: "Average",
  description: "Computes the arithmetic mean of two numbers (a and b)",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: false, description: "First number" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: false, description: "Second number" }),
    input: defineInputPort({ name: "input", type: PortTypes.NUMBER, required: false, description: "Input number" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Average result" }),
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Average result (alias)" }),
  },
  configSchema: {},
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs) => {
    const vals = [];
    if (inputs.a !== undefined) vals.push(Number(inputs.a));
    if (inputs.b !== undefined) vals.push(Number(inputs.b));
    if (inputs.input !== undefined && inputs.a === undefined) vals.push(Number(inputs.input));

    if (vals.length === 0) return { output: 0, result: 0 };
    const avg = vals.reduce((acc, v) => acc + v, 0) / vals.length;
    return { output: avg, result: avg };
  },
};
