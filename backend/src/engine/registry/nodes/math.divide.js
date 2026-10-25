/**
 * Node: math.divide
 * Computes quotient (a / b) with division by zero protection.
 * Inputs: a (dividend), b (divisor, optional with config fallback).
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

module.exports = {
  type: "math.divide",
  version: 1,
  category: "mathematical",
  label: "Divide",
  description: "Computes division (a / b)",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: false, description: "Dividend" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: false, description: "Divisor (optional, uses divisor config if not connected)" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Quotient result (a / b)" }),
  },
  configSchema: {
    divisor: {
      type: "number",
      required: false,
      default: 1,
      description: "Default divisor if port 'b' is not connected",
    },
  },
  validateConfig: (config = {}) => {
    if (config.divisor !== undefined) {
      if (typeof config.divisor !== "number" || !Number.isFinite(config.divisor)) {
        return { valid: false, errors: ["Divisor must be a finite number"], field: "config.divisor" };
      }
      if (config.divisor === 0) {
        return { valid: false, errors: ["Divisor configuration cannot be 0"], field: "config.divisor" };
      }
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const valA = inputs.a !== undefined ? inputs.a : inputs.input;
    const divisor = inputs.b !== undefined
      ? inputs.b
      : (node.config && node.config.divisor !== undefined ? node.config.divisor : 1);

    const numDivisor = Number(divisor);
    if (numDivisor === 0) {
      throw new EngineError(
        ErrorCodes.DIVISION_BY_ZERO,
        "Division by zero is not allowed",
        { nodeId: node && node.id, a: valA, b: divisor }
      );
    }
    const quotient = Number(valA || 0) / numDivisor;
    return { output: quotient };
  },
};
