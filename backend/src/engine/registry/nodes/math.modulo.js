/**
 * Node: math.modulo
 * Computes a % b (or input % divisor) with modulo-by-zero protection
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

module.exports = {
  type: "math.modulo",
  version: 1,
  category: "mathematical",
  label: "Modulo",
  description: "Computes the remainder of division of two numbers (a % b or input % divisor)",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.NUMBER, required: false, description: "Dividend" }),
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: false, description: "Dividend (a)" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: false, description: "Divisor (b)" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Remainder result" }),
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Remainder result (alias)" }),
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
    const rawVal = inputs.input !== undefined ? inputs.input : inputs.a;
    const divisor = inputs.b !== undefined
      ? inputs.b
      : (node.config && node.config.divisor !== undefined ? node.config.divisor : 1);

    const numDivisor = Number(divisor);
    if (numDivisor === 0) {
      throw new EngineError(
        ErrorCodes.DIVISION_BY_ZERO,
        "Modulo by zero is not allowed",
        { nodeId: node && node.id, a: rawVal, b: divisor }
      );
    }
    const dividend = Number(rawVal || 0);
    const rem = dividend % numDivisor;
    return { output: rem, result: rem };
  },
};
