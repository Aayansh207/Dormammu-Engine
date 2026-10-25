/**
 * Node: data.validate
 * Validates incoming JSON payload against required fields, data types, and value constraints.
 * Fails fast with structured VALIDATION_FAILED error if payload does not conform.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

module.exports = {
  type: "data.validate",
  version: 1,
  category: "data",
  label: "Validate Data",
  description: "Validates input payload against required fields and constraints; passes through if valid",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.ANY, required: true, description: "Payload to validate" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.ANY, description: "Validated payload (pass-through)" }),
    valid: defineOutputPort({ name: "valid", type: PortTypes.BOOLEAN, description: "True if payload passed validation" }),
  },
  configSchema: {
    requiredFields: {
      type: "array",
      required: false,
      default: [],
      description: "List of field names that must exist and be non-empty",
    },
    rules: {
      type: "object",
      required: false,
      default: {},
      description: "Validation rules per field, e.g. { errorRate: { min: 0, max: 1 }, affectedUsers: { min: 0 } }",
    },
  },
  validateConfig: (config = {}) => {
    if (config.requiredFields !== undefined && !Array.isArray(config.requiredFields)) {
      return { valid: false, errors: ["'requiredFields' must be an array of strings"], field: "config.requiredFields" };
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const config = node.config || {};
    const data = inputs.input;

    if (data === undefined || data === null || (typeof data !== "object" && typeof data !== "string")) {
      throw new EngineError(
        ErrorCodes.VALIDATION_FAILED,
        "Input payload is required for validation",
        { port: "input" }
      );
    }

    const payloadObj = typeof data === "object" ? data : {};
    const validationErrors = [];

    // 1. Check required fields
    if (Array.isArray(config.requiredFields)) {
      for (const field of config.requiredFields) {
        const val = payloadObj[field];
        if (val === undefined || val === null || val === "") {
          validationErrors.push(`Required field '${field}' is missing or empty`);
        }
      }
    }

    // 2. Check field constraints
    if (config.rules && typeof config.rules === "object") {
      for (const [field, rule] of Object.entries(config.rules)) {
        const val = payloadObj[field];
        if (val !== undefined && val !== null) {
          if (rule.type && typeof val !== rule.type) {
            validationErrors.push(`Field '${field}' must be of type '${rule.type}' (got '${typeof val}')`);
          }
          if (typeof val === "number") {
            if (rule.min !== undefined && val < rule.min) {
              validationErrors.push(`Field '${field}' must be >= ${rule.min} (got ${val})`);
            }
            if (rule.max !== undefined && val > rule.max) {
              validationErrors.push(`Field '${field}' must be <= ${rule.max} (got ${val})`);
            }
          }
        }
      }
    }

    if (validationErrors.length > 0) {
      throw new EngineError(
        ErrorCodes.VALIDATION_FAILED,
        `Payload validation failed: ${validationErrors.join("; ")}`,
        { errors: validationErrors, payload: data }
      );
    }

    return {
      output: data,
      valid: true,
    };
  },
};
