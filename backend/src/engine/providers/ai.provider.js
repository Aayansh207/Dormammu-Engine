/**
 * Webster Execution Engine - AI Provider Abstraction
 * Supports Google Gemini and OpenAI with explicit, labelled [DEMO MOCK] fallback for offline environments.
 */

const { ErrorCodes, EngineError } = require("../contracts/errors");

const AI_TIMEOUT_MS = 15000;

/**
 * Dispatches a prompt to Google Gemini via REST API
 */
async function callGemini(apiKey, prompt, systemInstruction = "", abortSignal = null) {
  const model = "gemini-1.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  if (abortSignal) {
    abortSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new EngineError(
        ErrorCodes.AI_PROVIDER_ERROR,
        `Gemini API error (${res.status}): ${errText.slice(0, 300)}`,
        { status: res.status }
      );
    }

    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) {
      throw new EngineError(ErrorCodes.AI_INVALID_OUTPUT, "Gemini returned empty candidate content");
    }
    return { text: rawText, provider: "gemini", mode: "live" };
  } catch (err) {
    if (controller.signal.aborted) {
      throw new EngineError(ErrorCodes.AI_TIMEOUT, `Gemini request timed out after ${AI_TIMEOUT_MS}ms`);
    }
    if (err instanceof EngineError) throw err;
    throw new EngineError(ErrorCodes.AI_PROVIDER_ERROR, `Gemini network error: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dispatches a prompt to OpenAI via Chat Completions REST API
 */
async function callOpenAI(apiKey, prompt, systemInstruction = "", abortSignal = null) {
  const url = "https://api.openai.com/v1/chat/completions";
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
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new EngineError(
        ErrorCodes.AI_PROVIDER_ERROR,
        `OpenAI API error (${res.status}): ${errText.slice(0, 300)}`,
        { status: res.status }
      );
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new EngineError(ErrorCodes.AI_INVALID_OUTPUT, "OpenAI returned empty message content");
    }
    return { text: rawText, provider: "openai", mode: "live" };
  } catch (err) {
    if (controller.signal.aborted) {
      throw new EngineError(ErrorCodes.AI_TIMEOUT, `OpenAI request timed out after ${AI_TIMEOUT_MS}ms`);
    }
    if (err instanceof EngineError) throw err;
    throw new EngineError(ErrorCodes.AI_PROVIDER_ERROR, `OpenAI network error: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dispatches a prompt to xAI Grok via REST API
 */
async function callGrok(apiKey, prompt, systemInstruction = "", abortSignal = null, model = "grok-beta") {
  const url = "https://api.x.ai/v1/chat/completions";
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
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "grok-beta",
        messages,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new EngineError(
        ErrorCodes.AI_PROVIDER_ERROR,
        `Grok API error (${res.status}): ${errText.slice(0, 300)}`,
        { status: res.status, provider: "grok" }
      );
    }

    const data = await res.json();
    const rawText = data.choices?.[0]?.message?.content;
    if (!rawText) {
      throw new EngineError(ErrorCodes.AI_INVALID_OUTPUT, "Grok returned empty message content", { provider: "grok" });
    }
    return { text: rawText, provider: "grok", mode: "live" };
  } catch (err) {
    if (controller.signal.aborted) {
      throw new EngineError(ErrorCodes.AI_TIMEOUT, `Grok request timed out after ${AI_TIMEOUT_MS}ms`, { provider: "grok" });
    }
    if (err instanceof EngineError) throw err;
    throw new EngineError(ErrorCodes.AI_PROVIDER_ERROR, `Grok network error: ${err.message}`, { provider: "grok" });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Deterministic, visibly labelled mock execution when no external AI keys are configured.
 */
function callMockAi(taskType, payload) {
  const commonMeta = {
    provider: "mock",
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
        confidence: 0.94,
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
 * Supports Grok (xAI), Gemini, and OpenAI with explicit provider selection and transparent offline mock.
 */
async function executeAiTask(taskType, payload, options = {}) {
  const preferredProvider = (options.provider || payload.provider || "auto").toLowerCase();
  const requestedModel = options.model || payload.model;
  const abortSignal = options.abortSignal || null;

  const grokKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const prompt = `Perform the following ${taskType} task and return ONLY JSON:\nPayload: ${JSON.stringify(payload)}`;

  // 1. Grok Execution (if explicitly requested, or auto when grokKey is present)
  if ((preferredProvider === "grok" || preferredProvider === "xai") || (preferredProvider === "auto" && grokKey)) {
    if (!grokKey) {
      throw new EngineError(
        ErrorCodes.AI_PROVIDER_ERROR,
        "xAI Grok provider was selected but GROK_API_KEY (or XAI_API_KEY) is not configured in environment"
      );
    }
    try {
      const res = await callGrok(grokKey, prompt, "", abortSignal, requestedModel || "grok-beta");
      const parsed = JSON.parse(res.text);
      return {
        ...parsed,
        provider: "grok",
        mode: "live",
        isDemo: false,
        badge: "⚡ LIVE AI (Grok)",
      };
    } catch (err) {
      // Re-throw: never disguise a provider failure as a fake mock response
      throw err;
    }
  }

  // 2. Gemini Execution (if explicitly requested, or auto when geminiKey is present)
  if (preferredProvider === "gemini" || (preferredProvider === "auto" && geminiKey)) {
    if (!geminiKey) {
      throw new EngineError(
        ErrorCodes.AI_PROVIDER_ERROR,
        "Google Gemini provider was selected but GEMINI_API_KEY is not configured in environment"
      );
    }
    try {
      const res = await callGemini(geminiKey, prompt, "", abortSignal);
      const parsed = JSON.parse(res.text);
      return {
        ...parsed,
        provider: "gemini",
        mode: "live",
        isDemo: false,
        badge: "⚡ LIVE AI (Gemini)",
      };
    } catch (err) {
      throw err;
    }
  }

  // 3. OpenAI Execution (if explicitly requested, or auto when openaiKey is present)
  if (preferredProvider === "openai" || (preferredProvider === "auto" && openaiKey)) {
    if (!openaiKey) {
      throw new EngineError(
        ErrorCodes.AI_PROVIDER_ERROR,
        "OpenAI provider was selected but OPENAI_API_KEY is not configured in environment"
      );
    }
    try {
      const res = await callOpenAI(openaiKey, prompt, "", abortSignal);
      const parsed = JSON.parse(res.text);
      return {
        ...parsed,
        provider: "openai",
        mode: "live",
        isDemo: false,
        badge: "⚡ LIVE AI (OpenAI)",
      };
    } catch (err) {
      throw err;
    }
  }

  // 4. Explicit, transparent fallback to deterministic offline mock only when no credentials exist
  return callMockAi(taskType, payload);
}

module.exports = {
  executeAiTask,
  callGrok,
  callGemini,
  callOpenAI,
  callMockAi,
};
