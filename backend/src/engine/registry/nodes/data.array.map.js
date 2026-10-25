/**
 * Node: data.array.map
 * Transforms array elements using safe, declarative mapping operations without arbitrary eval.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

const MAX_ARRAY_SIZE = 5000;
const SUPPORTED_OPERATIONS = [
  "extract_field",
  "to_uppercase",
  "to_lowercase",
  "trim",
  "math_multiply",
  "math_add",
  "wrap_object",
  "filter_truthy",
];

function resolvePath(obj, path) {
  if (!obj || typeof obj !== "object" || !path) return undefined;
  return String(path).split(".").reduce((acc, part) => (acc !== null && acc !== undefined ? acc[part] : undefined), obj);
}

module.exports = {
  type: "data.array.map",
  version: 1,
  category: "data",
  label: "Array Map",
  description: "Transforms items in an array using safe, declarative mapping operations",
  inputs: {
    input: defineInputPort({
      name: "input",
      type: PortTypes.ARRAY,
      required: true,
      description: "Array of items to transform",
    }),
  },
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.ARRAY,
      description: "Transformed array",
    }),
  },
  configSchema: {
    operation: {
      type: "string",
      required: true,
      default: "extract_field",
      enum: SUPPORTED_OPERATIONS,
      description: "Mapping transformation operation",
    },
    field: {
      type: "string",
      required: false,
      description: "Property path to extract (for 'extract_field') or wrapper key (for 'wrap_object')",
    },
    operand: {
      type: "number",
      required: false,
      default: 1,
      description: "Numeric operand for 'math_multiply' or 'math_add'",
    },
  },
  validateConfig: (config = {}) => {
    if (!config.operation || !SUPPORTED_OPERATIONS.includes(config.operation)) {
      return {
        valid: false,
        errors: [`Invalid operation '${config.operation}'. Must be one of: ${SUPPORTED_OPERATIONS.join(", ")}`],
        field: "config.operation",
      };
    }
    if (config.operation === "extract_field" && (!config.field || typeof config.field !== "string")) {
      return {
        valid: false,
        errors: ["Operation 'extract_field' requires a non-empty string 'field' in configuration"],
        field: "config.field",
      };
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const rawArray = inputs.input;
    if (!Array.isArray(rawArray)) {
      throw new EngineError(
        ErrorCodes.ARRAY_MAP_INVALID_INPUT,
        `Expected input port to receive an Array, but received ${typeof rawArray}`,
        { inputType: typeof rawArray }
      );
    }

    if (rawArray.length > MAX_ARRAY_SIZE) {
      throw new EngineError(
        ErrorCodes.ARRAY_MAP_INVALID_INPUT,
        `Input array exceeds maximum allowable limit of ${MAX_ARRAY_SIZE} items (received ${rawArray.length})`,
        { count: rawArray.length, maxLimit: MAX_ARRAY_SIZE }
      );
    }

    const config = node.config || {};
    const operation = config.operation || "extract_field";
    const field = config.field;
    const operand = Number(config.operand !== undefined ? config.operand : 1);

    let mapped;
    switch (operation) {
      case "extract_field":
        mapped = rawArray.map((item) => resolvePath(item, field));
        break;
      case "to_uppercase":
        mapped = rawArray.map((item) => (item !== null && item !== undefined ? String(item).toUpperCase() : ""));
        break;
      case "to_lowercase":
        mapped = rawArray.map((item) => (item !== null && item !== undefined ? String(item).toLowerCase() : ""));
        break;
      case "trim":
        mapped = rawArray.map((item) => (item !== null && item !== undefined ? String(item).trim() : ""));
        break;
      case "math_multiply":
        mapped = rawArray.map((item) => (Number.isFinite(Number(item)) ? Number(item) * operand : 0));
        break;
      case "math_add":
        mapped = rawArray.map((item) => (Number.isFinite(Number(item)) ? Number(item) + operand : operand));
        break;
      case "wrap_object":
        mapped = rawArray.map((item) => ({ [field || "value"]: item }));
        break;
      case "filter_truthy":
        mapped = rawArray.filter(Boolean);
        break;
      default:
        throw new EngineError(ErrorCodes.ARRAY_MAP_INVALID_INPUT, `Unsupported array map operation: ${operation}`);
    }

    return { output: mapped };
  },
};
