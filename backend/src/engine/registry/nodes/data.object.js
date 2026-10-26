/**
 * Node: data.object
 * Constructs structured JSON objects from configured static fields and dynamic input mappings.
 * Safely handles nested paths and preserves all falsy values (0, false, "", null).
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function safeSetNested(obj, path, val) {
  if (!path || typeof path !== "string") return;
  const parts = path.split(".");

  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i].trim();
    if (FORBIDDEN_KEYS.has(part)) {
      throw new EngineError(
        ErrorCodes.DATA_OBJECT_INVALID_KEY,
        `Forbidden object property key '${part}' to prevent prototype pollution`,
        { key: part }
      );
    }
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part];
  }

  const finalKey = parts[parts.length - 1].trim();
  if (FORBIDDEN_KEYS.has(finalKey)) {
    throw new EngineError(
      ErrorCodes.DATA_OBJECT_INVALID_KEY,
      `Forbidden object property key '${finalKey}' to prevent prototype pollution`,
      { key: finalKey }
    );
  }
  current[finalKey] = val;
}

module.exports = {
  type: "data.object",
  version: 1,
  category: "data",
  label: "Build Object",
  description: "Constructs structured objects from key-value pairs, nested paths, and dynamic inputs",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.ANY, required: false, description: "Optional base object or input data" }),
    value: defineInputPort({ name: "value", type: PortTypes.ANY, required: false, description: "Dynamic value for targetKey" }),
    telemetry: defineInputPort({ name: "telemetry", type: PortTypes.ANY, required: false, description: "Optional telemetry data object" }),
    derivedMetrics: defineInputPort({ name: "derivedMetrics", type: PortTypes.ANY, required: false, description: "Optional derived metrics object" }),
    aiAnalysis: defineInputPort({ name: "aiAnalysis", type: PortTypes.ANY, required: false, description: "Optional AI analysis object" }),
    actionPlan: defineInputPort({ name: "actionPlan", type: PortTypes.ANY, required: false, description: "Optional action plan object or string" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.OBJECT, description: "Constructed object" }),
  },
  configSchema: {
    fields: {
      type: "array",
      required: false,
      default: [],
      description: "List of fields: [{ key: 'user.name', value: 'John', fromInput: false }]",
    },
    targetKey: {
      type: "string",
      required: false,
      description: "Target key for dynamic 'value' input port",
    },
  },
  validateConfig: (config = {}) => {
    if (config.fields !== undefined && !Array.isArray(config.fields)) {
      return { valid: false, errors: ["Config 'fields' must be an array"], field: "config.fields" };
    }
    if (config.fields) {
      for (let i = 0; i < config.fields.length; i++) {
        const item = config.fields[i];
        if (!item || typeof item !== "object" || !item.key || typeof item.key !== "string") {
          return { valid: false, errors: [`Field at index ${i} must have a non-empty string 'key'`], field: `config.fields[${i}]` };
        }
        for (const segment of item.key.split(".")) {
          if (FORBIDDEN_KEYS.has(segment.trim())) {
            return { valid: false, errors: [`Forbidden key '${segment}' at index ${i}`], field: `config.fields[${i}].key` };
          }
        }
      }
    }
    if (config.targetKey !== undefined) {
      for (const segment of String(config.targetKey).split(".")) {
        if (FORBIDDEN_KEYS.has(segment.trim())) {
          return { valid: false, errors: [`Forbidden targetKey '${segment}'`], field: "config.targetKey" };
        }
      }
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const config = node.config || {};
    const result = {};

    // If inheritInput is not explicitly false, start with shallow clone as base
    if (config.inheritInput !== false && inputs.input && typeof inputs.input === "object" && !Array.isArray(inputs.input)) {
      Object.assign(result, inputs.input);
    }

    // Set configured fields
    if (Array.isArray(config.fields)) {
      for (const field of config.fields) {
        if (!field.key) continue;
        let val = field.value;

        // If fromPort is configured, read directly from inputs[field.fromPort]
        if (field.fromPort && inputs[field.fromPort] !== undefined) {
          val = inputs[field.fromPort];
        } else if (field.fromInput && inputs.input && typeof inputs.input === "object") {
          const lookupKey = field.inputKey || field.key;
          const candidates = String(lookupKey).split("|").map((k) => k.trim());
          for (const cand of candidates) {
            val = cand.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), inputs.input);
            if (val !== undefined) break;
          }
        }

        safeSetNested(result, field.key, val);
      }
    }

    // Direct multi-port attachments if supplied (clean and structured)
    if (inputs.telemetry !== undefined) {
      const tel = inputs.telemetry?.body || inputs.telemetry;
      result.serviceTelemetry = tel;
    }
    if (inputs.derivedMetrics !== undefined) {
      result.derivedMetrics = inputs.derivedMetrics;
    }
    if (inputs.aiAnalysis !== undefined) {
      const ai = inputs.aiAnalysis;
      if (ai && typeof ai === "object") {
        const { _aiExecution, ...cleanAi } = ai;
        result.aiAnalysis = cleanAi;
      } else {
        result.aiAnalysis = ai;
      }
    }
    if (inputs.actionPlan !== undefined) {
      result.actionPlan = inputs.actionPlan;
    }

    // If targetKey is configured and port 'value' has input, attach it
    if (config.targetKey && inputs.value !== undefined) {
      safeSetNested(result, config.targetKey, inputs.value);
    }

    // Generate metadata if this is an operations report
    if (result.serviceTelemetry || result.aiAnalysis || result.derivedMetrics) {
      result.reportGeneratedAt = new Date().toISOString();
      result.status = "INVESTIGATION_COMPLETE";
    }

    return { output: result };
  },
};
