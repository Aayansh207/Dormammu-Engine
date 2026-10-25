/**
 * Node: math.average
 * Computes arithmetic mean of numbers (a and b, or array on a).
 * Inputs: a (first number or array of numbers), b (second number).
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.average",
  version: 1,
  category: "mathematical",
  label: "Average",
  description: "Computes the arithmetic mean of numbers",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: false, description: "First number (or array of numbers)" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: false, description: "Second number" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Average result" }),
  },
  configSchema: {},
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs) => {
    const vals = [];
    const valA = inputs.a !== undefined ? inputs.a : inputs.input;
    if (Array.isArray(valA)) {
      vals.push(...valA.map(Number));
    } else if (valA !== undefined) {
      vals.push(Number(valA));
    }
    if (inputs.b !== undefined) vals.push(Number(inputs.b));

    if (vals.length === 0) return { output: 0 };
    const avg = vals.reduce((acc, v) => acc + v, 0) / vals.length;
    return { output: avg };
  },
};
