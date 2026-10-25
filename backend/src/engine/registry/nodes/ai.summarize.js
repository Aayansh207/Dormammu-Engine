/**
 * Node: ai.summarize
 * Generates concise summaries and bullet takeaways from text using AI models.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");
const { executeAiTask } = require("../../providers/ai.provider");

module.exports = {
  type: "ai.summarize",
  version: 1,
  category: "ai",
  label: "AI Summarize",
  description: "Produces concise summaries and key bullet points from text using artificial intelligence",
  inputs: {
    text: defineInputPort({ name: "text", type: PortTypes.ANY, required: false, description: "Text or structured object to summarize" }),
    input: defineInputPort({ name: "input", type: PortTypes.ANY, required: false, description: "Alternative input for text" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.STRING, description: "Generated summary text" }),
    keyPoints: defineOutputPort({ name: "keyPoints", type: PortTypes.ARRAY, description: "Extracted bullet points and takeaways" }),
    provider: defineOutputPort({ name: "provider", type: PortTypes.STRING, description: "AI provider ('gemini', 'openai', or 'mock')" }),
    mode: defineOutputPort({ name: "mode", type: PortTypes.STRING, description: "Execution mode ('live' or 'demo')" }),
  },
  configSchema: {
    format: {
      type: "string",
      required: false,
      default: "paragraph",
      enum: ["paragraph", "bullet_points", "one_sentence"],
      description: "Summary format style",
    },
    maxLength: {
      type: "number",
      required: false,
      default: 300,
      description: "Target maximum length in characters",
    },
    instructions: {
      type: "string",
      required: false,
      description: "Additional summarization instructions or focus areas",
    },
  },
  validateConfig: (config = {}) => {
    if (config.format && !["paragraph", "bullet_points", "one_sentence"].includes(config.format)) {
      return { valid: false, errors: ["'format' must be 'paragraph', 'bullet_points', or 'one_sentence'"], field: "config.format" };
    }
    if (config.maxLength !== undefined && (typeof config.maxLength !== "number" || config.maxLength <= 0)) {
      return { valid: false, errors: ["'maxLength' must be a positive number"], field: "config.maxLength" };
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
        "Text content for AI summarization cannot be empty",
        { port: "text" }
      );
    }

    const result = await executeAiTask(
      "summarize",
      {
        text,
        format: config.format || "paragraph",
        maxLength: Number(config.maxLength || 300),
        instructions: config.instructions,
      },
      { abortSignal: context.abortSignal }
    );

    const summaryText = result.summary || (typeof result.text === "string" ? result.text : String(result));
    const keyPoints = Array.isArray(result.keyPoints) ? result.keyPoints : [summaryText];

    return {
      output: summaryText,
      keyPoints,
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
