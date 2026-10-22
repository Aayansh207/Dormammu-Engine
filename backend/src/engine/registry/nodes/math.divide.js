/**
 * Node: math.divide
 * Computes a / b with division by zero checking
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

module.exports = {
  type: "math.divide",
  version: "1.0.0",
  category: "math",
  label: "Divide",
  description: "Computes the quotient of two numbers (a / b)",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.NUMBER, required: true, description: "Dividend" }),
    b: defineInputPort({ name: "b", type: PortTypes.NUMBER, required: true, description: "Divisor" }),
  },
  outputs: {
    result: defineOutputPort({ name: "result", type: PortTypes.NUMBER, description: "Quotient result" }),
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const divisor = Number(inputs.b);
    if (divisor === 0) {
      throw new EngineError(
        ErrorCodes.DIVISION_BY_ZERO,
        "Division by zero is not allowed",
        { nodeId: node && node.id, a: inputs.a, b: inputs.b }
      );
    }
    return { result: Number(inputs.a) / divisor };
  },
};
