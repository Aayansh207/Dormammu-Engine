/**
 * Node: math.divide
 * Computes a / b (with division by zero protection)
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

module.exports = {
  type: "math.divide",
  version: 1,
  category: "mathematical",
  label: "Divide",
  description: "Computes division (a / b or input / divisor)",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.NUMBER, required: false, description: "Dividend" }),
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: false, description: "Dividend (a)" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: false, description: "Divisor (b)" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.NUMBER, description: "Quotient result" }),
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Quotient result (alias)" }),
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
      throw new EngineError(ErrorCodes.DIVISION_BY_ZERO, "Division by zero encountered in math.divide node", {
        nodeId: node.id,
      });
    }

    const quotient = Number(rawVal || 0) / numDivisor;
    return { output: quotient, result: quotient };
  },
};
