/**
 * Webster Execution Engine - In-Process Cron Scheduler Service
 * Manages recurring scheduled workflow executions with duplicate prevention and validation.
 */

const prisma = require("../config/db");
const { isValidCronExpression } = require("../engine/registry/nodes/trigger.cron");

/**
 * Checks if a 5-part cron field matches a given numeric value.
 * Supports: *, numbers (5), lists (1,2,3), ranges (1-5), and steps (* / 5, 1-10/2).
 */
function matchCronField(pattern, value) {
  if (pattern === "*") return true;

  const parts = pattern.split(",");
  for (const part of parts) {
    if (part.includes("/")) {
      const [range, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10) || 1;
      let start = 0;
      let end = 59;
      if (range !== "*") {
        if (range.includes("-")) {
          const [rStart, rEnd] = range.split("-").map((v) => parseInt(v, 10));
          start = rStart;
          end = rEnd;
        } else {
          start = parseInt(range, 10) || 0;
        }
      }
      if (value >= start && value <= end && (value - start) % step === 0) {
        return true;
      }
    } else if (part.includes("-")) {
      const [start, end] = part.split("-").map((v) => parseInt(v, 10));
      if (value >= start && value <= end) return true;
    } else {
      if (parseInt(part, 10) === value) return true;
    }
  }
  return false;
}

/**
 * Checks if a standard 5-part cron expression matches a given date in UTC.
 * @param {string} expr - 'min hour dom mon dow'
 * @param {Date} date
 */
function isCronMatch(expr, date = new Date()) {
  const trimmed = expr.trim().toLowerCase();
  if (trimmed === "@hourly") return date.getUTCMinutes() === 0;
  if (trimmed === "@daily" || trimmed === "@midnight") return date.getUTCMinutes() === 0 && date.getUTCHours() === 0;
  if (trimmed === "@weekly") return date.getUTCMinutes() === 0 && date.getUTCHours() === 0 && date.getUTCDay() === 0;
  if (trimmed === "@monthly") return date.getUTCMinutes() === 0 && date.getUTCHours() === 0 && date.getUTCDate() === 1;

  const fields = trimmed.split(/\s+/);
  if (fields.length !== 5) return false;

  const [minPattern, hourPattern, domPattern, monPattern, dowPattern] = fields;

  const curMin = date.getUTCMinutes();
  const curHour = date.getUTCHours();
  const curDom = date.getUTCDate();
  const curMon = date.getUTCMonth() + 1; // 1-12
  const curDow = date.getUTCDay(); // 0-6

  return (
    matchCronField(minPattern, curMin) &&
    matchCronField(hourPattern, curHour) &&
    matchCronField(domPattern, curDom) &&
    matchCronField(monPattern, curMon) &&
    matchCronField(dowPattern, curDow)
  );
}

class CronSchedulerService {
  constructor() {
    this._schedules = new Map(); // workflowId -> { workflowId, ownerId, cronExpression, timezone, enabled, running }
    this._tickerInterval = null;
    this._isStarted = false;
  }

  /**
   * Starts the 60-second ticker loop.
   */
  start() {
    if (this._isStarted) return;
    this._isStarted = true;
    this._tickerInterval = setInterval(() => this.tick(), 60000);
    // Don't block Node process from exiting
    if (this._tickerInterval.unref) this._tickerInterval.unref();
  }

  /**
   * Stops the ticker.
   */
  stop() {
    if (this._tickerInterval) {
      clearInterval(this._tickerInterval);
      this._tickerInterval = null;
    }
    this._isStarted = false;
  }

  /**
   * Registers or updates a workflow schedule.
   * @param {string} workflowId
   * @param {Object} options
   */
  registerSchedule(workflowId, { ownerId, cronExpression, timezone = "UTC", enabled = true }) {
    if (!isValidCronExpression(cronExpression)) {
      throw new Error(`Invalid cron expression: '${cronExpression}'`);
    }

    this._schedules.set(workflowId, {
      workflowId,
      ownerId,
      cronExpression: cronExpression.trim(),
      timezone,
      enabled: Boolean(enabled),
      running: false,
      lastRunAt: null,
      lastRunId: null,
      runCount: 0,
    });

    return this.getSchedule(workflowId);
  }

  /**
   * Unregisters a workflow schedule.
   * @param {string} workflowId
   */
  unregisterSchedule(workflowId) {
    return this._schedules.delete(workflowId);
  }

  /**
   * Retrieves schedule details for a workflow.
   * @param {string} workflowId
   */
  getSchedule(workflowId) {
    return this._schedules.get(workflowId) || null;
  }

  /**
   * Lists all currently registered active schedules.
   */
  listSchedules() {
    return Array.from(this._schedules.values());
  }

  /**
   * Executes a scheduled workflow run immediately or during a tick.
   * Prevents duplicate overlapping executions for the same workflow.
   * @param {string} workflowId
   * @param {Date} [triggerTime=new Date()]
   */
  async executeScheduledRun(workflowId, triggerTime = new Date()) {
    const schedule = this._schedules.get(workflowId);
    if (!schedule) throw new Error(`No schedule registered for workflow '${workflowId}'`);
    if (!schedule.enabled) return null;

    if (schedule.running) {
      console.warn(`[CronScheduler] Skipping scheduled run for '${workflowId}': previous run still active`);
      return null;
    }

    schedule.running = true;
    try {
      const scheduledAt = triggerTime.toISOString();
      const triggerData = {
        $cron: true,
        $triggerType: "CRON",
        scheduledAt,
        cronExpression: schedule.cronExpression,
      };

      const workflowService = require("../services/workflow.service");
      const result = await workflowService.executeWorkflowRun(schedule.ownerId, workflowId, {
        triggerData,
      });

      schedule.lastRunAt = scheduledAt;
      schedule.lastRunId = result.runId;
      schedule.runCount += 1;

      return result;
    } finally {
      schedule.running = false;
    }
  }

  /**
   * Scans PostgreSQL for all active workflows containing a `trigger.cron` node
   * and registers them in the active schedule pool.
   */
  async syncFromDatabase() {
    try {
      const workflows = await prisma.workflow.findMany({
        include: {
          versions: {
            orderBy: { version: "desc" },
            take: 1,
          },
        },
      });

      let registeredCount = 0;
      const seenIds = new Set();

      for (const wf of workflows) {
        const latestVersion = wf.versions[0];
        if (!latestVersion?.definitionJson) continue;

        const def = latestVersion.definitionJson;
        const cronNode = (def.nodes || []).find((n) => n.type === "trigger.cron");

        if (cronNode) {
          const config = cronNode.config || {};
          const cronExpr = config.cronExpression || "0 * * * *";
          const timezone = config.timezone || "UTC";
          const enabled = config.enabled !== false;

          seenIds.add(wf.id);
          this.registerSchedule(wf.id, {
            ownerId: wf.ownerId,
            cronExpression: cronExpr,
            timezone,
            enabled,
          });
          registeredCount++;
        }
      }

      // Cleanup any schedules that no longer have a cron trigger in DB
      for (const existingId of this._schedules.keys()) {
        if (!seenIds.has(existingId)) {
          this.unregisterSchedule(existingId);
        }
      }

      return { registered: registeredCount };
    } catch (err) {
      console.warn("[CronScheduler] Could not synchronize schedules from DB:", err.message);
      return { registered: 0, error: err.message };
    }
  }

  /**
   * Synchronizes a single workflow's cron schedule based on its definition.
   * @param {string} workflowId
   * @param {string} ownerId
   * @param {Object} definition
   */
  syncWorkflowDefinition(workflowId, ownerId, definition) {
    if (!definition || !Array.isArray(definition.nodes)) {
      this.unregisterSchedule(workflowId);
      return;
    }

    const cronNode = definition.nodes.find((n) => n.type === "trigger.cron");
    if (!cronNode) {
      this.unregisterSchedule(workflowId);
      return;
    }

    const config = cronNode.config || {};
    const cronExpr = config.cronExpression || "0 * * * *";
    const timezone = config.timezone || "UTC";
    const enabled = config.enabled !== false;

    this.registerSchedule(workflowId, {
      ownerId,
      cronExpression: cronExpr,
      timezone,
      enabled,
    });
  }

  /**
   * Evaluates all registered schedules against the current minute.
   * @param {Date} [now=new Date()]
   */
  async tick(now = new Date()) {
    const executedRuns = [];
    for (const [workflowId, schedule] of this._schedules.entries()) {
      if (schedule.enabled && !schedule.running) {
        if (isCronMatch(schedule.cronExpression, now)) {
          const runPromise = this.executeScheduledRun(workflowId, now).catch((err) => {
            console.error(`[CronScheduler] Execution failed for scheduled workflow '${workflowId}':`, err.message);
          });
          executedRuns.push(runPromise);
        }
      }
    }
    return Promise.all(executedRuns);
  }
}

const defaultCronScheduler = new CronSchedulerService();

module.exports = {
  CronSchedulerService,
  defaultCronScheduler,
  isCronMatch,
  matchCronField,
};
