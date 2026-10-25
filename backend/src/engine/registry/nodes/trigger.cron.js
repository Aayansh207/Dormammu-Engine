/**
 * Node: trigger.cron
 * Initiates workflow execution based on a scheduled cron expression or timer.
 * Emits execution timestamp, schedule metadata, and incoming run payload.
 */

const { defineOutputPort, PortTypes } = require("../../contracts/ports");
const { ErrorCodes, EngineError } = require("../../contracts/errors");

// Helper regex for standard 5-part cron: minute hour day-of-month month day-of-week
const CRON_REGEX = /^([0-9,\-\/\*]+)\s+([0-9,\-\/\*]+)\s+([0-9,\-\/\*]+)\s+([0-9,\-\/\*]+)\s+([0-9,\-\/\*]+)$/;

function isValidCronExpression(expr) {
  if (typeof expr !== "string") return false;
  const trimmed = expr.trim();
  // Standard shorthand keywords
  if (["@hourly", "@daily", "@midnight", "@weekly", "@monthly", "@yearly", "@annually"].includes(trimmed)) {
    return true;
  }
  return CRON_REGEX.test(trimmed);
}

module.exports = {
  type: "trigger.cron",
  version: 1,
  category: "trigger",
  label: "Cron Scheduler Trigger",
  description: "Initiates workflow execution on a recurring cron schedule or interval",
  inputs: {},
  outputs: {
    output: defineOutputPort({ name: "output", type: PortTypes.OBJECT, description: "Schedule event details" }),
    timestamp: defineOutputPort({ name: "timestamp", type: PortTypes.STRING, description: "Execution trigger timestamp (ISO 8601)" }),
    cron: defineOutputPort({ name: "cron", type: PortTypes.STRING, description: "Triggered cron expression" }),
  },
  configSchema: {
    cronExpression: {
      type: "string",
      required: true,
      default: "0 * * * *",
      description: "Standard 5-part cron expression (e.g. '*/15 * * * *' for every 15 mins)",
    },
    timezone: {
      type: "string",
      required: false,
      default: "UTC",
      description: "Timezone for schedule calculation (e.g. 'UTC', 'America/New_York')",
    },
    enabled: {
      type: "boolean",
      required: false,
      default: true,
      description: "Whether this scheduled trigger is active",
    },
  },
  validateConfig: (config = {}) => {
    if (config.cronExpression !== undefined) {
      if (!isValidCronExpression(config.cronExpression)) {
        return {
          valid: false,
          errors: [`Invalid cron expression '${config.cronExpression}'. Expected 5 standard fields (min hour dom mon dow)`],
          field: "config.cronExpression",
        };
      }
    }
    return { valid: true };
  },
  capabilities: {
    pure: false,
    sideEffects: false,
    retryable: true,
  },
  handler: async (inputs, node, context = {}) => {
    const config = node.config || {};
    const triggerData = context.triggerData || {};

    const scheduledAt = triggerData.scheduledAt || new Date().toISOString();
    const cron = config.cronExpression || "0 * * * *";
    const timezone = config.timezone || "UTC";

    const output = {
      scheduledAt,
      cronExpression: cron,
      timezone,
      triggerType: "cron",
      nodeId: node.id,
      ...(triggerData.$cron ? triggerData.payload || {} : triggerData),
    };

    return {
      output,
      timestamp: scheduledAt,
      cron,
    };
  },
  isValidCronExpression,
};
