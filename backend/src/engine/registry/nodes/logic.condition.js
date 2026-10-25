/**
 * Node: logic.condition
 * Evaluates a condition and routes execution along distinct true/false control-flow branches.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

const SUPPORTED_OPERATORS = [
  "==",
  "===",
  "!=",
  "!==",
  ">",
  ">=",
  "<",
  "<=",
  "truthy",
  "falsy",
  "empty",
  "not_empty",
  "contains",
  "starts_with",
  "ends_with",
  "regex",
];

function isValueEmpty(val) {
  if (val === null || val === undefined) return true;
  if (typeof val === "string" || Array.isArray(val)) return val.length === 0;
  if (typeof val === "object") return Object.keys(val).length === 0;
  return false;
}

function evaluateCondition(valA, operator, valB) {
  switch (operator) {
    case "==":
      // eslint-disable-next-line eqeqeq
      return valA == valB;
    case "===":
      return valA === valB;
    case "!=":
      // eslint-disable-next-line eqeqeq
      return valA != valB;
    case "!==":
      return valA !== valB;
    case ">":
      return Number(valA) > Number(valB);
    case ">=":
      return Number(valA) >= Number(valB);
    case "<":
      return Number(valA) < Number(valB);
    case "<=":
      return Number(valA) <= Number(valB);
    case "truthy":
      return Boolean(valA);
    case "falsy":
      return !Boolean(valA);
    case "empty":
      return isValueEmpty(valA);
    case "not_empty":
      return !isValueEmpty(valA);
    case "contains":
      if (typeof valA === "string" || Array.isArray(valA)) {
        return valA.includes(valB);
      }
      if (typeof valA === "object" && valA !== null) {
        return Object.prototype.hasOwnProperty.call(valA, String(valB));
      }
      return false;
    case "starts_with":
      return typeof valA === "string" && valA.startsWith(String(valB));
    case "ends_with":
      return typeof valA === "string" && valA.endsWith(String(valB));
    case "regex":
      try {
        const re = new RegExp(String(valB));
        return re.test(String(valA));
      } catch (e) {
        throw new EngineError(
          ErrorCodes.INVALID_CONDITION_OPERATOR,
          `Invalid regular expression pattern '${valB}': ${e.message}`,
          { pattern: valB }
        );
      }
    default:
      throw new EngineError(
        ErrorCodes.INVALID_CONDITION_OPERATOR,
        `Unsupported condition operator '${operator}'`,
        { operator, supported: SUPPORTED_OPERATORS }
      );
  }
}

module.exports = {
  type: "logic.condition",
  version: 1,
  category: "logic",
  label: "Condition (If/Else)",
  description: "Evaluates a condition and routes execution along distinct true or false branch ports",
  inputs: {
    a: defineInputPort({ name: "a", type: PortTypes.ANY, required: false, description: "First operand or value to test" }),
    b: defineInputPort({ name: "b", type: PortTypes.ANY, required: false, description: "Second operand for comparison" }),
    input: defineInputPort({ name: "input", type: PortTypes.ANY, required: false, description: "Alternative alias for operand 'a'" }),
    data: defineInputPort({ name: "data", type: PortTypes.ANY, required: false, description: "Optional data payload to pass through active branch" }),
  },
  outputs: {
    true: defineOutputPort({ name: "true", type: PortTypes.ANY, description: "Emitted when the condition evaluates to true" }),
    false: defineOutputPort({ name: "false", type: PortTypes.ANY, description: "Emitted when the condition evaluates to false" }),
    output: defineOutputPort({ name: "output", type: PortTypes.BOOLEAN, description: "The boolean outcome of the evaluation" }),
  },
  configSchema: {
    operator: {
      type: "string",
      required: false,
      default: "==",
      enum: SUPPORTED_OPERATORS,
      description: "Comparison operator to evaluate",
    },
    value: {
      type: "any",
      required: false,
      description: "Fallback comparison value if port 'b' is not connected",
    },
    passThrough: {
      type: "boolean",
      required: false,
      default: true,
      description: "If true, the active branch emits operand 'a' (or 'data' if connected); if false, emits boolean outcome",
    },
  },
  validateConfig: (config = {}) => {
    if (config.operator !== undefined && !SUPPORTED_OPERATORS.includes(config.operator)) {
      return {
        valid: false,
        errors: [`Invalid operator '${config.operator}'. Must be one of: ${SUPPORTED_OPERATORS.join(", ")}`],
        field: "config.operator",
      };
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const config = node.config || {};
    const operator = config.operator || "==";
    const valA = inputs.a !== undefined ? inputs.a : inputs.input;
    const valB = inputs.b !== undefined ? inputs.b : config.value;

    const conditionResult = evaluateCondition(valA, operator, valB);
    const candidateData = inputs.data !== undefined ? inputs.data : valA;
    const passValue = config.passThrough !== false
      ? (candidateData !== undefined ? candidateData : conditionResult)
      : conditionResult;

    if (conditionResult) {
      return {
        true: passValue,
        output: true,
      };
    } else {
      return {
        false: passValue,
        output: false,
      };
    }
  },
};
