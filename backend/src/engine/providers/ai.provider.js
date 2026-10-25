/**
 * Webster Execution Engine - AI Provider Abstraction
 * Sole Provider: Groq AI (LPU Inference Engine)
 * Default Model: llama-3.3-70b-versatile
 * Completely removed all other AI providers (Gemini, OpenAI, Mock choices)
 */

const { ErrorCodes, EngineError } = require("../contracts/errors");

const AI_TIMEOUT_MS = 20000;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

/**
 * Strips potential markdown code blocks (e.g. ```json ... ```) and parses JSON safely.
 */
function parseAiJsonResponse(rawText, provider = "groq") {
  if (!rawText || typeof rawText !== "string") {
    throw new EngineError(ErrorCodes.AI_INVALID_OUTPUT, `${provider} returned empty response content`, { provider });
  }

  let clean = rawText.trim();
  if (clean.startsWith("```json")) {
    clean = clean.slice(7);
  } else if (clean.startsWith("```")) {
    clean = clean.slice(3);
  }
  if (clean.endsWith("```")) {
    clean = clean.slice(0, -3);
  }
  clean = clean.trim();

  try {
    return JSON.parse(clean);
  } catch (err) {
    // Attempt regex extraction of first JSON object if surrounded by preamble
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerErr) {
        // Fall through to error
      }
    }
    throw new EngineError(
      ErrorCodes.AI_INVALID_OUTPUT,
      `${provider} response was not valid JSON: ${clean.slice(0, 200)}`,
      { provider, raw: clean.slice(0, 300) }
    );
  }
}

/**
 * Dispatches a prompt to Groq AI via OpenAI-compatible REST API
 * Default model: openai/gpt-oss-120b (high speed, 120B parameters on Groq LPU)
 */
async function callGroq(apiKey, prompt, systemInstruction = "", abortSignal = null, model = DEFAULT_GROQ_MODEL) {
  const sanitizedKey = String(apiKey || "").trim();
  const activeModel = model || DEFAULT_GROQ_MODEL;

  // Groq chat completions endpoint (supports xAI fallback if xai key provided)
  const isXaiKey = sanitizedKey.startsWith("xai-");
  const url = isXaiKey ? "https://api.x.ai/v1/chat/completions" : GROQ_API_URL;
  let dispatchModel = isXaiKey && activeModel.includes("openai") ? "grok-2-latest" : activeModel;

  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  if (abortSignal) {
    abortSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    let res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sanitizedKey}`,
      },
      body: JSON.stringify({
        model: dispatchModel,
        messages,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    // If requested model returns 404 model_not_found, seamlessly fall back to primary available Groq model
    if (!res.ok && res.status === 404 && dispatchModel !== DEFAULT_GROQ_MODEL && !isXaiKey) {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sanitizedKey}`,
        },
        body: JSON.stringify({
          model: DEFAULT_GROQ_MODEL,
          messages,
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
      if (res.ok) {
        dispatchModel = DEFAULT_GROQ_MODEL;
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new EngineError(
        ErrorCodes.AI_PROVIDER_ERROR,
        `Groq AI API error (${res.status}): ${errText.slice(0, 300)}`,
        { status: res.status, provider: "groq", model: dispatchModel }
      );
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new EngineError(
        ErrorCodes.AI_INVALID_OUTPUT,
        "Groq AI returned empty message content",
        { provider: "groq", model: dispatchModel }
      );
    }
    return { text: rawText, provider: "groq", model: dispatchModel, mode: "live" };
  } catch (err) {
    if (controller.signal.aborted) {
      throw new EngineError(
        ErrorCodes.AI_TIMEOUT,
        `Groq AI request timed out after ${AI_TIMEOUT_MS}ms`,
        { provider: "groq", model: activeModel }
      );
    }
    if (err instanceof EngineError) throw err;
    throw new EngineError(
      ErrorCodes.AI_PROVIDER_ERROR,
      `Groq AI network error: ${err.message}`,
      { provider: "groq", model: activeModel }
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Backward compatibility alias
 */
const callGrok = callGroq;

/**
 * Deterministic, visibly labelled mock execution when explicitly requested or in test mode.
 */
function callMockAi(taskType, payload) {
  const commonMeta = {
    provider: "groq",
    mode: "demo",
    isDemo: true,
    badge: "🎭 DEMO MODE (Deterministic Simulation)",
  };

  switch (taskType) {
    case "classify": {
      const { text = "", categories = [] } = payload;
      const lower = text.toLowerCase();
      let matched = categories[0] || "general";

      for (const cat of categories) {
        const cLower = String(cat).toLowerCase();
        if (lower.includes(cLower)) {
          matched = cat;
          break;
        }
      }

      // Keyword heuristics for support triage & operations center
      if (lower.includes("outage") || lower.includes("504") || lower.includes("crash") || lower.includes("down") || lower.includes("emergency") || lower.includes("payment")) {
        const critMatch = categories.find((c) => /outage|critical|urgent|high/i.test(String(c)));
        if (critMatch) matched = critMatch;
      } else if (lower.includes("latency") || lower.includes("slow") || lower.includes("degradation") || lower.includes("warning") || lower.includes("spike")) {
        const warnMatch = categories.find((c) => /degradation|warning|performance|medium/i.test(String(c)));
        if (warnMatch) matched = warnMatch;
      } else if (lower.includes("billing") || lower.includes("invoice") || lower.includes("question") || lower.includes("clarification") || lower.includes("standard")) {
        const normMatch = categories.find((c) => /billing|inquiry|support|standard|general|normal/i.test(String(c)));
        if (normMatch) matched = normMatch;
      }

      return {
        ...commonMeta,
        category: matched,
        confidence: 0.95,
        reasoning: `[DEMO MOCK - Offline Deterministic Fallback] Matched based on semantic keyword presence in text '${text.slice(0, 50)}...'`,
      };
    }

    case "extract": {
      const { text = "", schema = {} } = payload;
      const extracted = {};

      for (const [key, expectedType] of Object.entries(schema)) {
        if (key === "customerName" || key === "name") {
          const match = text.match(/(?:from|name|customer|user)[:\s]+([A-Za-z\s]+?)(?:[.,\n]|$)/i);
          extracted[key] = match ? match[1].trim() : "Alice Smith";
        } else if (key === "email") {
          const match = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
          extracted[key] = match ? match[1] : "user@example.com";
        } else if (key === "priority") {
          extracted[key] = /urgent|critical|asap|down/i.test(text) ? "high" : "normal";
        } else if (key === "ticketId" || key === "id") {
          const match = text.match(/(?:ticket|id|#)[:\s#]*([A-Za-z0-9-_]+)/i);
          extracted[key] = match ? match[1] : "TICK-1001";
        } else if (expectedType === "number") {
          const match = text.match(/\b\d+(\.\d+)?\b/);
          extracted[key] = match ? Number(match[0]) : 1;
        } else {
          extracted[key] = `Extracted ${key}`;
        }
      }

      return {
        ...commonMeta,
        extracted,
      };
    }

    case "summarize": {
      const { text = "", maxLength = 300, format = "paragraph" } = payload;
      const sentences = text
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      let summaryText = sentences.slice(0, 2).join(". ");
      if (summaryText.length > maxLength) {
        summaryText = summaryText.slice(0, maxLength - 3) + "...";
      }
      if (!summaryText.endsWith(".")) summaryText += ".";

      return {
        ...commonMeta,
        summary: `[DEMO MOCK] ${summaryText}`,
        keyPoints: sentences.slice(0, 3).map((s) => `• ${s}`),
      };
    }

    default:
      return {
        ...commonMeta,
        result: `[DEMO MOCK] Response for ${taskType}`,
      };
  }
}

/**
 * Unified AI execution dispatcher
 * SOLE PROVIDER: Groq AI (LPU Inference Engine)
 * Default Model: llama-3.3-70b-versatile
 */
async function executeAiTask(taskType, payload, options = {}) {
  const requestedModel = options.model || payload.model || DEFAULT_GROQ_MODEL;
  const abortSignal = options.abortSignal || null;

  // Retrieve Groq API Key from node config override or process environment
  const groqKey = options.apiKey || payload.apiKey || process.env.GROQ_API_KEY || process.env.GROK_API_KEY || process.env.XAI_API_KEY;

  if (!groqKey) {
    // In offline automated test environments or when explicitly permitted via ALLOW_OFFLINE_MOCK, fallback transparently if not strict
    if (!options.strict && (process.env.ALLOW_OFFLINE_MOCK === "true" || process.env.NODE_ENV === "test")) {
      return callMockAi(taskType, payload);
    }

    throw new EngineError(
      ErrorCodes.AI_PROVIDER_ERROR,
      "Groq AI provider is configured, but no API key was provided. Please add GROQ_API_KEY to your backend/.env file or specify apiKey on the AI node.",
      { provider: "groq", missingEnv: "GROQ_API_KEY" }
    );
  }

  // Build task-tailored prompt & system instructions for high-accuracy Groq output
  let systemInstruction = "";
  let userPrompt = "";

  if (taskType === "classify") {
    const categories = payload.categories || ["urgent", "bug", "billing", "general"];
    systemInstruction =
      "You are an expert triage and classification AI powered by Groq. You must classify the input into exactly one of the target categories. " +
      "You MUST return ONLY a valid JSON object matching this schema:\n" +
      '{"category": string, "confidence": number, "reasoning": string, "severity": "critical" | "warning" | "normal"}\n' +
      "Do NOT return markdown backticks or commentary.";
    userPrompt =
      `Target Categories: ${JSON.stringify(categories)}\n\n` +
      `Input Text to Classify:\n${payload.text}\n` +
      (payload.instructions ? `\nInstructions: ${payload.instructions}` : "");
  } else if (taskType === "extract") {
    const schema = payload.schema || {};
    systemInstruction =
      "You are an expert data extraction AI powered by Groq. Extract structured entities from the input text strictly adhering to the schema. " +
      "You MUST return ONLY a valid JSON object matching this schema:\n" +
      '{"extracted": object}\n' +
      "Do NOT return markdown backticks or commentary.";
    userPrompt =
      `Target Schema: ${JSON.stringify(schema, null, 2)}\n\n` +
      `Input Text:\n${payload.text}\n` +
      (payload.instructions ? `\nInstructions: ${payload.instructions}` : "");
  } else if (taskType === "summarize") {
    const format = payload.format || "paragraph";
    const maxLength = payload.maxLength || 300;
    systemInstruction =
      "You are an executive summarization AI powered by Groq. Produce a crisp, accurate summary and bullet key points. " +
      "You MUST return ONLY a valid JSON object matching this schema:\n" +
      '{"summary": string, "keyPoints": string[]}\n' +
      "Do NOT return markdown backticks or commentary.";
    userPrompt =
      `Desired Format: ${format}\n` +
      `Max Length: ${maxLength} characters\n\n` +
      `Input Text:\n${payload.text}\n` +
      (payload.instructions ? `\nInstructions: ${payload.instructions}` : "");
  } else {
    systemInstruction = "You are a helpful AI powered by Groq that returns ONLY a valid JSON object.";
    userPrompt = `Perform the task '${taskType}' for the following payload and return JSON:\n${JSON.stringify(payload)}`;
  }

  const res = await callGroq(groqKey, userPrompt, systemInstruction, abortSignal, requestedModel);
  const parsed = parseAiJsonResponse(res.text, "groq");

  return {
    ...parsed,
    provider: "groq",
    model: res.model || requestedModel,
    mode: "live",
    isDemo: false,
    badge: `⚡ LIVE AI (Groq: ${res.model || requestedModel})`,
  };
}

module.exports = {
  executeAiTask,
  callGroq,
  callGrok,
  callMockAi,
};
