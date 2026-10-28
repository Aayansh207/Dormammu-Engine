/**
 * Node: flow.delay
 * Pauses workflow execution for a configured duration without blocking the event loop.
 * Supports clean cancellation via AbortSignal.
 */

const { defineInputPort, defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

const MAX_DELAY_MS = 300000; // 5 minutes max in-process delay limit

module.exports = {
  type: "flow.delay",
  version: 1,
  category: "flow",
  label: "Delay",
  description: "Pauses execution for a configured duration without blocking the Node.js event loop",
  inputs: {
    input: defineInputPort({ name: "input", type: PortTypes.ANY, required: false, description: "Data to pass through after delay" }),
  },
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.ANY, description: "The passthrough data value" }),
    delayedMs: defineOutputPort({ name: "delayedMs", type: PortTypes.NUMBER, description: "Exact elapsed delay in milliseconds" }),
    delayedByQueue: defineOutputPort({ name: "delayedByQueue", type: PortTypes.BOOLEAN, description: "Whether delayed natively by distributed queue scheduler" }),
  },
  configSchema: {
    durationMs: {
      type: "number",
      required: false,
      default: 1000,
      description: "Delay duration in milliseconds (0 to 300,000ms / 5 minutes)",
    },
  },
  validateConfig: (config = {}) => {
    if (config.durationMs !== undefined) {
      if (typeof config.durationMs !== "number" || !Number.isFinite(config.durationMs) || config.durationMs < 0) {
        return { valid: false, errors: ["durationMs must be a non-negative number"], field: "config.durationMs" };
      }
      if (config.durationMs > MAX_DELAY_MS) {
        return { valid: false, errors: [`durationMs exceeds maximum allowed limit of ${MAX_DELAY_MS}ms (5 minutes)`], field: "config.durationMs" };
      }
    }
    return { valid: true };
  },
  capabilities: {
    pure: false,
    sideEffects: false,
    retryable: true,
    timeoutMs: MAX_DELAY_MS + 10000,
  },
  handler: async (inputs, node, context = {}) => {
    const config = node.config || {};
    let durationMs = 1000;
    if (config.durationMs !== undefined) {
      durationMs = Number(config.durationMs);
    } else if (config.duration !== undefined) {
      const unit = (config.unit || "milliseconds").toLowerCase();
      const mult = unit.startsWith("sec") ? 1000 : unit.startsWith("min") ? 60000 : 1;
      durationMs = Number(config.duration) * mult;
    }

    if (durationMs < 0 || durationMs > MAX_DELAY_MS || Number.isNaN(durationMs)) {
      throw new EngineError(
        ErrorCodes.DELAY_DURATION_INVALID,
        `Invalid delay duration '${durationMs}'ms. Must be between 0 and ${MAX_DELAY_MS}ms.`,
        { durationMs, maxAllowed: MAX_DELAY_MS }
      );
    }

    if (context.abortSignal && context.abortSignal.aborted) {
      throw new EngineError(ErrorCodes.EXECUTION_CANCELLED, "Execution cancelled before delay began");
    }

    // In distributed execution mode, BullMQ has already delayed job dispatch by durationMs
    if (context.isDelayedByQueue) {
      return {
        output: inputs.input !== undefined ? inputs.input : { delayedMs: durationMs },
        delayedMs: durationMs,
        delayedByQueue: true,
      };
    }

    const start = Date.now();

    await new Promise((resolve, reject) => {
      let timer = null;
      let onAbort = null;

      if (context.abortSignal) {
        onAbort = () => {
          if (timer) clearTimeout(timer);
          reject(new EngineError(ErrorCodes.EXECUTION_CANCELLED, "Execution cancelled during delay"));
        };
        context.abortSignal.addEventListener("abort", onAbort, { once: true });
      }

      timer = setTimeout(() => {
        if (context.abortSignal && onAbort) {
          context.abortSignal.removeEventListener("abort", onAbort);
        }
        resolve();
      }, durationMs);
    });

    const elapsed = Date.now() - start;
    return {
      output: inputs.input !== undefined ? inputs.input : { delayedMs: elapsed },
      delayedMs: elapsed,
    };
  },
};
