/**
 * Node: ai.classify
 * Classifies input text into a configured set of categories using AI provider models.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");
const { executeAiTask } = require("../../providers/ai.provider");

const DEFAULT_CATEGORIES = ["urgent", "bug", "feature_request", "billing", "general"];

module.exports = {
  type: "ai.classify",
  version: 1,
  category: "ai",
  label: "AI Classify",
  description: "Classifies text into configured categories using artificial intelligence",
  inputs: {
    text: defineInputPort({ name: "text", type: PortTypes.ANY, required: false, description: "Text content or structured object to classify" }),
    input: defineInputPort({ name: "input", type: PortTypes.ANY, required: false, description: "Alternative input for text" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.STRING, description: "The assigned category" }),
    category: defineOutputPort({ name: "category", type: PortTypes.STRING, description: "Assigned category alias" }),
    severity: defineOutputPort({ name: "severity", type: PortTypes.STRING, description: "Calculated severity ('critical', 'warning', 'normal')" }),
    confidence: defineOutputPort({ name: "confidence", type: PortTypes.NUMBER, description: "Confidence score between 0 and 1" }),
    reasoning: defineOutputPort({ name: "reasoning", type: PortTypes.STRING, description: "Explanation for the classification" }),
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
    categories: {
      type: "array",
      required: false,
      default: DEFAULT_CATEGORIES,
      description: "List of valid target categories",
    },
    instructions: {
      type: "string",
      required: false,
      description: "Custom system instructions for classification",
    },
  },
  validateConfig: (config = {}) => {
    if (config.categories !== undefined) {
      if (!Array.isArray(config.categories) || config.categories.length === 0) {
        return { valid: false, errors: ["'categories' must be a non-empty array of strings"], field: "config.categories" };
      }
    }
    return { valid: true };
  },
  capabilities: { pure: false, sideEffects: false, retryable: true, timeoutMs: 20000 },
  handler: async (inputs, node, context = {}) => {
    const config = node.config || {};
    let rawText = inputs.text !== undefined ? inputs.text : inputs.input;
    let text = "";

    if (rawText && typeof rawText === "object") {
      const parts = [rawText.title, rawText.description, rawText.issue, rawText.message, rawText.text, rawText.content].filter(Boolean);
      text = parts.length > 0 ? parts.join(" - ") : JSON.stringify(rawText);
    } else {
      text = String(rawText || "");
    }

    if (!text || text.trim() === "") {
      throw new EngineError(
        ErrorCodes.REQUIRED_INPUT_MISSING,
        "Text content for AI classification cannot be empty",
        { port: "text" }
      );
    }

    const categories = Array.isArray(config.categories) && config.categories.length > 0
      ? config.categories
      : DEFAULT_CATEGORIES;

    const result = await executeAiTask(
      "classify",
      {
        text,
        categories,
        instructions: config.instructions,
      },
      {
        abortSignal: context.abortSignal,
        provider: config.provider,
        model: config.model,
      }
    );

    const assignedCategory = result.category || categories[0];
    const confidence = typeof result.confidence === "number" ? result.confidence : 0.9;
    const reasoning = result.reasoning || `Classified as ${assignedCategory}`;

    let severity = result.severity;
    if (!severity) {
      const lowerCat = String(assignedCategory).toLowerCase();
      if (/urgent|critical|outage|emergency|high/i.test(lowerCat)) severity = "critical";
      else if (/warning|degradation|medium/i.test(lowerCat)) severity = "warning";
      else severity = "normal";
    }

    return {
      output: assignedCategory,
      category: assignedCategory,
      severity,
      confidence,
      reasoning,
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
