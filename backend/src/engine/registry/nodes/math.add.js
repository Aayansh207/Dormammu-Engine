/**
 * Node: math.add
 * Computes the sum of numbers (a + b).
 * Inputs: a (first operand), b (second operand, optional with addend config fallback).
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.add",
  version: 1,
  category: "mathematical",
  label: "Add",
  description: "Computes the sum of two numbers (a + b)",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: false, description: "First number" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: false, description: "Second number (optional, uses addend if not connected)" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Sum result (a + b)" }),
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
    let rawA = inputs.a !== undefined ? inputs.a : inputs.input;
    let rawB = inputs.b !== undefined
      ? inputs.b
      : (node.config && node.config.addend !== undefined ? node.config.addend : 0);

    if (typeof rawA === "object" && rawA !== null && !Array.isArray(rawA)) {
      rawA = rawA.value !== undefined ? rawA.value : (rawA.output !== undefined ? rawA.output : (rawA.payload !== undefined ? rawA.payload : (node.config?.a ?? 0)));
    }
    if (typeof rawB === "object" && rawB !== null && !Array.isArray(rawB)) {
      rawB = rawB.value !== undefined ? rawB.value : (rawB.output !== undefined ? rawB.output : (rawB.payload !== undefined ? rawB.payload : (node.config?.b ?? node.config?.addend ?? 0)));
    }

    const numA = Number(rawA !== undefined && rawA !== null && rawA !== "" ? rawA : (node.config?.a ?? 0));
    const numB = Number(rawB !== undefined && rawB !== null && rawB !== "" ? rawB : (node.config?.b ?? node.config?.addend ?? 0));

    const sum = (Number.isNaN(numA) ? 0 : numA) + (Number.isNaN(numB) ? 0 : numB);
    return { output: sum };
  },
};
