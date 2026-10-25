/**
 * Node: text.template
 * Safely renders string templates using mustache-style {{variable}} interpolation.
 * Avoids any arbitrary code execution or eval.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

function escapeHtml(str) {
  if (typeof str !== "string") str = String(str);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resolvePath(obj, path) {
  if (!obj || typeof obj !== "object" || !path) return undefined;
  return path.split(".").reduce((acc, part) => (acc !== null && acc !== undefined ? acc[part] : undefined), obj);
}

function validateTemplateSyntax(templateStr) {
  let openCount = 0;
  for (let i = 0; i < templateStr.length - 1; i++) {
    if (templateStr[i] === "{" && templateStr[i + 1] === "{") {
      openCount++;
      i++;
    } else if (templateStr[i] === "}" && templateStr[i + 1] === "}") {
      openCount--;
      i++;
      if (openCount < 0) {
        throw new EngineError(
          ErrorCodes.TEMPLATE_SYNTAX_ERROR,
          "Unexpected closing tag '}}' without matching opening tag '{{'",
          { position: i }
        );
      }
    }
  }
  if (openCount > 0) {
    throw new EngineError(
      ErrorCodes.TEMPLATE_SYNTAX_ERROR,
      "Unclosed template tag '{{' detected in template",
      { unclosedTags: openCount }
    );
  }
}

module.exports = {
  type: "text.template",
  version: 1,
  category: "text",
  label: "Text Template",
  description: "Renders text from a template string and input data using safe {{variable}} interpolation",
  inputs: {
    input: defineInputPort({
      name: "input",
      type: PortTypes.ANY,
      required: false,
      description: "Data object containing template variables",
    }),
  },
  outputs: {
    output: defineOutputPort({
      name: "output",
      type: PortTypes.STRING,
      description: "Rendered text result",
    }),
  },
  configSchema: {
    template: {
      type: "string",
      required: true,
      default: "Hello {{name}}!",
      description: "Text template with mustache-style {{variable}} tags",
    },
    missingVariablePolicy: {
      type: "string",
      required: false,
      default: "empty",
      enum: ["empty", "preserve", "error"],
      description: "How to handle missing variables: 'empty' (blank), 'preserve' (leave tag), or 'error'",
    },
    escapeHtml: {
      type: "boolean",
      required: false,
      default: false,
      description: "Whether to escape HTML entities in interpolated values",
    },
  },
  validateConfig: (config = {}) => {
    if (config.template !== undefined && typeof config.template !== "string") {
      return { valid: false, errors: ["Template must be a string"], field: "config.template" };
    }
    if (
      config.missingVariablePolicy !== undefined &&
      !["empty", "preserve", "error"].includes(config.missingVariablePolicy)
    ) {
      return {
        valid: false,
        errors: ["missingVariablePolicy must be 'empty', 'preserve', or 'error'"],
        field: "config.missingVariablePolicy",
      };
    }
    return { valid: true };
  },
  capabilities: { pure: true, sideEffects: false, retryable: true },
  handler: async (inputs, node) => {
    const config = node.config || {};
    const template = typeof config.template === "string" ? config.template : "";
    const policy = config.missingVariablePolicy || "empty";
    const doEscape = Boolean(config.escapeHtml);
    const data = inputs.input && typeof inputs.input === "object" ? inputs.input : {};

    // Validate syntax (check for unclosed tags)
    validateTemplateSyntax(template);

    // Replace {{path.to.var}}
    const rendered = template.replace(/\{\{\s*([a-zA-Z0-9_$.]+)\s*\}\}/g, (match, path) => {
      let val = resolvePath(data, path);
      if (val === undefined && path in data) {
        val = data[path];
      }

      if (val === undefined) {
        if (policy === "error") {
          throw new EngineError(
            ErrorCodes.TEMPLATE_SYNTAX_ERROR,
            `Template variable '{{${path}}}' could not be resolved from input data`,
            { variable: path }
          );
        }
        if (policy === "preserve") {
          return match;
        }
        return "";
      }

      const strVal = typeof val === "object" ? JSON.stringify(val) : String(val);
      return doEscape ? escapeHtml(strVal) : strVal;
    });

    return { output: rendered };
  },
};
