/**
 * Node: ai.extract
 * Extracts structured JSON entities from unstructured text conforming to a configured schema.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");
const { executeAiTask } = require("../../providers/ai.provider");

const DEFAULT_SCHEMA = {
  customerName: "string",
  email: "string",
  priority: "string",
};

module.exports = {
  type: "ai.extract",
  version: 1,
  category: "ai",
  label: "AI Extract",
  description: "Extracts structured entity objects from unstructured text matching a defined schema",
  inputs: {
    text: defineInputPort({ name: "text", type: PortTypes.ANY, required: false, description: "Source text or object to extract information from" }),
    input: defineInputPort({ name: "input", type: PortTypes.ANY, required: false, description: "Alternative input for text" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.OBJECT, description: "Extracted structured JSON entity object" }),
    provider: defineOutputPort({ name: "provider", type: PortTypes.STRING, description: "AI provider ('grok', 'gemini', 'openai', or 'mock')" }),
    mode: defineOutputPort({ name: "mode", type: PortTypes.STRING, description: "Execution mode ('live' or 'demo')" }),
  },
  configSchema: {
    provider: {
      type: "string",
      required: false,
      default: "auto",
      enum: ["auto", "grok", "gemini", "openai"],
      description: "AI Provider service: 'auto', 'grok' (xAI), 'gemini', or 'openai'",
    },
    model: {
      type: "string",
      required: false,
      description: "Specific model identifier (e.g. 'grok-beta', 'grok-2-latest', 'gemini-1.5-flash', 'gpt-4o-mini')",
    },
    schema: {
      type: "object",
      required: false,
      default: DEFAULT_SCHEMA,
      description: "Entity schema mapping field names to expected data types or descriptions",
    },
    instructions: {
      type: "string",
      required: false,
      description: "Additional extraction guidelines or prompt constraints",
    },
  },
  validateConfig: (config = {}) => {
    if (config.schema !== undefined && (typeof config.schema !== "object" || config.schema === null)) {
      return { valid: false, errors: ["'schema' must be an object"], field: "config.schema" };
    }
    return { valid: true };
  },
  capabilities: { pure: false, sideEffects: false, retryable: true, timeoutMs: 20000 },
  handler: async (inputs, node, context = {}) => {
    const config = node.config || {};
    let rawText = inputs.text !== undefined ? inputs.text : inputs.input;
    let text = "";

    if (rawText && typeof rawText === "object") {
      text = rawText.issue || rawText.message || rawText.text || rawText.content || JSON.stringify(rawText);
    } else {
      text = String(rawText || "");
    }

    if (!text || text.trim() === "") {
      throw new EngineError(
        ErrorCodes.REQUIRED_INPUT_MISSING,
        "Text content for AI extraction cannot be empty",
        { port: "text" }
      );
    }

    const schema = config.schema && typeof config.schema === "object" ? config.schema : DEFAULT_SCHEMA;

    const result = await executeAiTask(
      "extract",
      {
        text,
        schema,
        instructions: config.instructions,
      },
      {
        abortSignal: context.abortSignal,
        provider: config.provider,
        model: config.model,
      }
    );

    const extracted = result.extracted || result.data || result;
    return {
      output: typeof extracted === "object" && extracted !== null ? extracted : { result: extracted },
      provider: result.provider,
      mode: result.mode,
      _aiExecution: {
        provider: result.provider,
        mode: result.mode,
        isDemo: Boolean(result.isDemo),
        badge: result.badge,
      },
    };
  },
};
