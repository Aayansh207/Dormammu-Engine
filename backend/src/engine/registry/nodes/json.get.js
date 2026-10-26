/**
 * Node: json.get
 * Safely extracts a nested property from an object by dot/bracket path notation.
 * Inputs: input (source object), path (optional dynamic path).
 * Output: single 'output' port.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");

function getPropertyByPath(obj, path) {
  if (obj === null || obj === undefined || !path) {
    return obj;
  }
  const cleanPath = String(path).trim();
  if (cleanPath === "" || cleanPath === ".") {
    return obj;
  }

  // Support pipe-delimited fallback paths e.g. "affected_users|affectedUsers"
  const candidatePaths = cleanPath.split("|").map(p => p.trim()).filter(Boolean);
  for (const candidate of candidatePaths) {
    const tokens = candidate
      .replace(/\[(\w+)\]/g, ".$1")
      .split(".")
      .filter((token) => token.length > 0);

    let current = obj;
    let found = true;
    for (const token of tokens) {
      if (current === null || current === undefined || !(token in Object(current))) {
        found = false;
        break;
      }
      current = current[token];
    }
    if (found && current !== undefined) {
      return current;
    }
  }

  // Automatic camelCase / snake_case alternative lookup
  const primary = candidatePaths[0];
  const camelAlt = primary.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  if (obj && typeof obj === "object" && obj[camelAlt] !== undefined) {
    return obj[camelAlt];
  }
  const snakeAlt = primary.replace(/([A-Z])/g, "_$1").toLowerCase();
  if (obj && typeof obj === "object" && obj[snakeAlt] !== undefined) {
    return obj[snakeAlt];
  }

  return undefined;
}

module.exports = {
  type: "json.get",
  version: 1,
  category: "json",
  label: "Get JSON Field",
  description: "Extracts a nested property from an object using a dot/bracket path",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.ANY, required: false, description: "Source object or array" }),
    path: defineInputPort({ name: "path", type: PortTypes.STRING, required: false, description: "Dynamic property path (e.g. 'user.name')" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.ANY, description: "Extracted property value" }),
  },
  configSchema: {
    path: {
      type: "string",
      required: false,
      default: "",
      description: "Dot notation path to extract (e.g., 'data.count' or 'user.name')",
    },
    defaultValue: {
      type: "any",
      required: false,
      default: null,
      description: "Default fallback value if path is not found",
    },
  },
  validateConfig: () => ({ valid: true }),
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const target = inputs.input !== undefined ? inputs.input : inputs.object;
    const path = (inputs.path !== undefined && inputs.path !== null)
      ? String(inputs.path)
      : (node.config && node.config.path ? node.config.path : "");

    const defVal = (node.config && node.config.defaultValue !== undefined)
      ? node.config.defaultValue
      : null;

    const extracted = getPropertyByPath(target, path);
    const result = extracted !== undefined ? extracted : defVal;
    return { output: result };
  },
};
