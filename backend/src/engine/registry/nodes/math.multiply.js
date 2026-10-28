/**
 * Node: math.multiply
 * Multiplies two numbers (a * b).
 * Inputs: a (multiplicand), b (multiplier, optional with factor config fallback).
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

module.exports = {
  type: "math.multiply",
  version: 1,
  category: "mathematical",
  label: "Multiply",
  description: "Computes the product of two numbers (a * b)",
  inputs: {
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
      description: "Multiplier (optional, uses factor if not connected)",
    }),
  },
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.NUMBER,
      description: "Product result (a * b)",
    }),
  },
  configSchema: {
    factor: {
      type: "number",
      required: false,
      default: 1,
      description: "Multiplier factor if port 'b' is not connected",
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
  capabilities: {
    pure: true,
    sideEffects: false,
    retryable: true,
  },
  handler: async (inputs, node) => {
    let rawA = inputs.a !== undefined ? inputs.a : inputs.input;
    let rawB = inputs.b !== undefined
      ? inputs.b
      : (node.config && node.config.factor !== undefined ? node.config.factor : 1);

    if (typeof rawA === "object" && rawA !== null && !Array.isArray(rawA)) {
      rawA = rawA.value !== undefined ? rawA.value : (rawA.output !== undefined ? rawA.output : (rawA.payload !== undefined ? rawA.payload : (node.config?.a ?? 0)));
    }
    if (typeof rawB === "object" && rawB !== null && !Array.isArray(rawB)) {
      rawB = rawB.value !== undefined ? rawB.value : (rawB.output !== undefined ? rawB.output : (rawB.payload !== undefined ? rawB.payload : (node.config?.b ?? node.config?.factor ?? 1)));
    }

    const numA = Number(rawA !== undefined && rawA !== null && rawA !== "" ? rawA : (node.config?.a ?? 0));
    const numB = Number(rawB !== undefined && rawB !== null && rawB !== "" ? rawB : (node.config?.b ?? node.config?.factor ?? 1));

    const prod = (Number.isNaN(numA) ? 0 : numA) * (Number.isNaN(numB) ? 1 : numB);
    return { output: prod };
  },
};
