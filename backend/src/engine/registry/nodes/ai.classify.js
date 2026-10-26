/**
 * Node: ai.classify
 * Classifies input text into a configured set of categories using Groq AI.
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
  description: "Classifies text into configured categories using Groq AI",
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
    leadingHypothesis: defineOutputPort({ name: "leadingHypothesis", type: PortTypes.STRING, description: "Leading causal hypothesis" }),
    alternativeExplanations: defineOutputPort({ name: "alternativeExplanations", type: PortTypes.ANY, description: "Alternative explanations" }),
    analysis: defineOutputPort({ name: "analysis", type: PortTypes.OBJECT, description: "Complete AI incident analysis package" }),
    provider: defineOutputPort({ name: "provider", type: PortTypes.STRING, description: "AI provider ('groq')" }),
    mode: defineOutputPort({ name: "mode", type: PortTypes.STRING, description: "Execution mode ('live' or 'demo')" }),
  },
  configSchema: {
    provider: {
      type: "string",
      required: false,
      default: "groq",
      enum: ["groq"],
      description: "AI Provider service: fixed exclusively to 'groq' (Groq AI)",
    },
    model: {
      type: "string",
      required: false,
      default: "llama-3.3-70b-versatile",
      description: "Groq model identifier (e.g. 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant')",
    },
    apiKey: {
      type: "string",
      required: false,
      description: "Optional Groq API Key override (falls back to GROQ_API_KEY from environment)",
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
        provider: "groq",
        model: config.model || "llama-3.3-70b-versatile",
        apiKey: config.apiKey,
      }
    );

    const assignedCategory = result.category || categories[0];
    const confidence = typeof result.confidence === "number" ? result.confidence : 0.9;
    const reasoning = result.reasoning || `Classified as ${assignedCategory}`;
    const leadingHypothesis = result.leadingHypothesis || reasoning;
    const alternativeExplanations = Array.isArray(result.alternativeExplanations)
      ? result.alternativeExplanations
      : ["Transient infrastructure variation"];

    let severity = result.severity;
    if (!severity) {
      const lowerCat = String(assignedCategory).toLowerCase();
      if (/urgent|critical|outage|emergency|high/i.test(lowerCat)) severity = "critical";
      else if (/warning|degradation|medium/i.test(lowerCat)) severity = "warning";
      else severity = "normal";
    }

    const analysisObj = {
      provider: "groq",
      model: result.model || config.model || "openai/gpt-oss-120b",
      category: assignedCategory,
      severity,
      confidence,
      reasoning,
      leadingHypothesis,
      alternativeExplanations,
      isVerifiedFact: false,
    };

    return {
      output: assignedCategory,
      category: assignedCategory,
      severity,
      confidence,
      reasoning,
      leadingHypothesis,
      alternativeExplanations,
      analysis: analysisObj,
      provider: "groq",
      mode: result.mode,
      _aiExecution: {
        provider: "groq",
        model: result.model || config.model || "openai/gpt-oss-120b",
        mode: result.mode,
        isDemo: Boolean(result.isDemo),
        badge: result.badge,
      },
    };
  },
};
