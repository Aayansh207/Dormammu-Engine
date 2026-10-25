/**
 * Node: logic.switch
 * Routes data and execution to a matching case branch or default fallback branch.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

function normalizeCases(casesConfig = []) {
  if (!Array.isArray(casesConfig)) return [];
  return casesConfig.map((item, idx) => {
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      const sanitizedPort = String(item).replace(/[^a-zA-Z0-9_]/g, "_") || `case_${idx}`;
      return { case: item, port: sanitizedPort };
    }
    if (typeof item === "object" && item !== null) {
      const caseVal = item.case !== undefined ? item.case : item.value;
      const portName = item.port || (caseVal !== undefined ? String(caseVal).replace(/[^a-zA-Z0-9_]/g, "_") : `case_${idx}`);
      return { case: caseVal, port: portName };
    }
    return { case: String(item), port: `case_${idx}` };
  });
}

function matchesCase(inputValue, caseValue, matchType = "exact") {
  if (matchType === "exact") {
    // eslint-disable-next-line eqeqeq
    return inputValue == caseValue;
  }
  if (matchType === "case_insensitive") {
    return String(inputValue).trim().toLowerCase() === String(caseValue).trim().toLowerCase();
  }
  if (matchType === "contains") {
    return String(inputValue).toLowerCase().includes(String(caseValue).toLowerCase());
  }
  return inputValue === caseValue;
}

module.exports = {
  type: "logic.switch",
  version: 1,
  category: "logic",
  label: "Switch",
  description: "Routes data along the matching case branch port or the default fallback branch",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.ANY, required: false, description: "Value to match against configured cases" }),
    value: defineInputPort({ name: "value", type: PortTypes.ANY, required: false, description: "Alternative alias for input" }),
  },
  outputs: {
    default: defineOutputPort({ name: "default", type: PortTypes.ANY, description: "Emitted when no cases match" }),
    output: defineOutputPort({ name: "output", type: PortTypes.ANY, description: "Matched case identifier or 'default'" }),
  },
  getDynamicOutputs: (config = {}) => {
    const outputs = {
      default: defineOutputPort({ name: "default", type: PortTypes.ANY, description: "Emitted when no cases match" }),
      output: defineOutputPort({ name: "output", type: PortTypes.ANY, description: "Matched case identifier or 'default'" }),
    };
    const cases = normalizeCases(config.cases || []);
    for (const c of cases) {
      if (c.port && !outputs[c.port]) {
        outputs[c.port] = defineOutputPort({
          name: c.port,
          type: PortTypes.ANY,
          description: `Case branch: ${c.case}`,
        });
      }
    }
    return outputs;
  },
  configSchema: {
    cases: {
      type: "array",
      required: true,
      default: ["case_1", "case_2"],
      description: "List of matchable cases (strings, numbers, or { case, port } objects)",
    },
    matchType: {
      type: "string",
      required: false,
      default: "exact",
      enum: ["exact", "case_insensitive", "contains"],
      description: "Comparison mode for matching input to cases",
    },
  },
  validateConfig: (config = {}) => {
    if (config.cases !== undefined) {
      if (!Array.isArray(config.cases)) {
        return { valid: false, errors: ["Config 'cases' must be an array"], field: "config.cases" };
      }
      const seenPorts = new Set(["default", "output"]);
      const seenCases = new Set();
      const normalized = normalizeCases(config.cases);

      for (let i = 0; i < normalized.length; i++) {
        const item = normalized[i];
        if (seenCases.has(item.case)) {
          return {
            valid: false,
            errors: [`Duplicate case value '${item.case}' detected at index ${i}`],
            field: `config.cases[${i}]`,
          };
        }
        seenCases.add(item.case);

        if (seenPorts.has(item.port)) {
          return {
            valid: false,
            errors: [`Duplicate or reserved port name '${item.port}' detected at index ${i}`],
            field: `config.cases[${i}].port`,
          };
        }
        seenPorts.add(item.port);
      }
    }
    if (config.matchType && !["exact", "case_insensitive", "contains"].includes(config.matchType)) {
      return { valid: false, errors: ["Invalid matchType. Must be exact, case_insensitive, or contains"], field: "config.matchType" };
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const config = node.config || {};
    const inputVal = inputs.input !== undefined ? inputs.input : inputs.value;
    const cases = normalizeCases(config.cases || []);
    const matchType = config.matchType || "exact";

    for (const c of cases) {
      if (matchesCase(inputVal, c.case, matchType)) {
        return {
          [c.port]: inputVal !== undefined ? inputVal : c.case,
          output: c.case,
        };
      }
    }

    // Default branch when no cases match
    return {
      default: inputVal !== undefined ? inputVal : "default",
      output: "default",
    };
  },
};
