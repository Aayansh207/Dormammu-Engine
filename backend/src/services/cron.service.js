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
    this._schedules = new Map(); // workflowId -> schedule object
    this._tickerInterval = null;
    this._isStarted = false;
  }

  /**
   * Starts the 1-second ticker loop for fine-grained interval and cron scheduling.
   */
  start() {
    if (this._isStarted) return;
    this._isStarted = true;
    this._tickerInterval = setInterval(() => this.tick(), 1000);
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
   * Registers or updates a workflow schedule (supports interval seconds or cron expression).
   * @param {string} workflowId
   * @param {Object} options
   */
  registerSchedule(workflowId, {
    ownerId,
    type = null,
    intervalSeconds = 10,
    cronExpression = null,
    timezone = "UTC",
    enabled = true,
    payload = null,
    stopOnError = true,
  }) {
    const existing = this._schedules.get(workflowId);

    // Determine type: "interval" or "cron"
    let scheduleType = type;
    if (!scheduleType) {
      if (cronExpression && isValidCronExpression(cronExpression)) {
        scheduleType = "cron";
      } else {
        scheduleType = "interval";
      }
    }

    if (scheduleType === "cron") {
      const expr = cronExpression || "0 * * * *";
      if (!isValidCronExpression(expr)) {
        throw new Error(`Invalid cron expression: '${expr}'`);
      }
      cronExpression = expr.trim();
    } else {
      scheduleType = "interval";
      intervalSeconds = Math.max(2, parseInt(intervalSeconds, 10) || 10);
    }

    const scheduleObj = {
      workflowId,
      ownerId,
      type: scheduleType,
      intervalSeconds,
      cronExpression: cronExpression || "0 * * * *",
      timezone,
      enabled: Boolean(enabled),
      payload: payload !== undefined && payload !== null ? payload : (existing?.payload || null),
      stopOnError: stopOnError !== false,
      running: false,
      lastTickAt: existing?.lastTickAt || Date.now(),
      lastCronMinuteKey: existing?.lastCronMinuteKey || null,
      lastRunAt: existing?.lastRunAt || null,
      lastRunId: existing?.lastRunId || null,
      lastStatus: existing?.lastStatus || null,
      lastError: existing?.lastError || null,
      runCount: existing?.runCount || 0,
      successCount: existing?.successCount || 0,
      failureCount: existing?.failureCount || 0,
    };

    this._schedules.set(workflowId, scheduleObj);
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
    const s = this._schedules.get(workflowId);
    if (!s) return null;
    return {
      workflowId: s.workflowId,
      type: s.type,
      intervalSeconds: s.intervalSeconds,
      cronExpression: s.cronExpression,
      timezone: s.timezone,
      enabled: s.enabled,
      payload: s.payload,
      stopOnError: s.stopOnError,
      running: s.running,
      lastRunAt: s.lastRunAt,
      lastRunId: s.lastRunId,
      lastStatus: s.lastStatus,
      lastError: s.lastError,
      runCount: s.runCount,
      successCount: s.successCount,
      failureCount: s.failureCount,
    };
  }

  /**
   * Lists all currently registered active schedules.
   */
  listSchedules() {
    return Array.from(this._schedules.values()).map((s) => ({
      workflowId: s.workflowId,
      type: s.type,
      intervalSeconds: s.intervalSeconds,
      cronExpression: s.cronExpression,
      enabled: s.enabled,
      lastRunAt: s.lastRunAt,
      lastStatus: s.lastStatus,
      lastError: s.lastError,
      runCount: s.runCount,
      failureCount: s.failureCount,
    }));
  }

  /**
   * Executes a scheduled workflow run immediately or during a tick.
   * Prevents duplicate overlapping executions for the same workflow.
   * On failure, records the error and optionally stops recurring schedule.
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
    const scheduledAt = triggerTime.toISOString();

    try {
      // Build incident payload
      const customPayload = schedule.payload && typeof schedule.payload === "object" ? { ...schedule.payload } : {};
      
      // Auto-refresh dynamic timestamp or incident ID if not explicitly fixed
      if (!customPayload.timestamp) {
        customPayload.timestamp = scheduledAt;
      }

      const triggerData = {
        ...customPayload,
        $cron: schedule.type === "cron",
        $interval: schedule.type === "interval",
        $triggerType: schedule.type === "interval" ? "INTERVAL" : "CRON",
        $intervalSeconds: schedule.intervalSeconds,
        scheduledAt,
        cronExpression: schedule.cronExpression,
      };

      const workflowService = require("../services/workflow.service");
      const { defaultSseService } = require("./sse.service");

      const result = await workflowService.executeWorkflowRun(schedule.ownerId, workflowId, {
        triggerData,
        triggerType: schedule.type === "interval" ? "INTERVAL" : "CRON",
      });

      schedule.lastRunAt = scheduledAt;
      schedule.lastRunId = result.runId;
      schedule.runCount += 1;

      if (result.status === "FAILED") {
        schedule.lastStatus = "FAILED";
        schedule.failureCount += 1;

        let failedTask = null;
        if (result.tasks) {
          failedTask = Object.values(result.tasks).find((t) => t.status === "FAILED");
        }

        const errCode = failedTask?.error?.code || result.error?.code || "EXECUTION_FAILED";
        const errMsg = result.error?.message || failedTask?.error?.message || "Execution encountered an error";
        const failedNode = failedTask?.nodeName || failedTask?.nodeId || result.error?.failedNodeId || null;

        schedule.lastError = {
          code: errCode,
          message: errMsg,
          details: failedTask?.error?.details || result.error?.details || null,
          nodeId: failedNode,
          timestamp: scheduledAt,
          runId: result.runId,
        };

        if (schedule.stopOnError) {
          schedule.enabled = false;
          console.warn(`[CronScheduler] Paused recurring schedule for '${workflowId}' due to run failure:`, schedule.lastError.message);
        }

        // Notify client via SSE
        defaultSseService.emitRunEvent(workflowId, "workflow:schedule_error", {
          workflowId,
          runId: result.runId,
          error: schedule.lastError,
          schedule: this.getSchedule(workflowId),
        });
      } else {
        schedule.lastStatus = "SUCCEEDED";
        schedule.lastError = null;
        schedule.successCount += 1;

        defaultSseService.emitRunEvent(workflowId, "workflow:schedule_tick", {
          workflowId,
          runId: result.runId,
          status: "SUCCEEDED",
          schedule: this.getSchedule(workflowId),
        });
      }

      return result;
    } catch (err) {
      schedule.lastRunAt = scheduledAt;
      schedule.lastStatus = "FAILED";
      schedule.failureCount += 1;
      schedule.lastError = {
        code: err.code || "TRIGGER_FAILED",
        message: err.message || "Failed to trigger scheduled run",
        timestamp: scheduledAt,
      };

      if (schedule.stopOnError) {
        schedule.enabled = false;
      }

      const { defaultSseService } = require("./sse.service");
      defaultSseService.emitRunEvent(workflowId, "workflow:schedule_error", {
        workflowId,
        error: schedule.lastError,
        schedule: this.getSchedule(workflowId),
      });

      throw err;
    } finally {
      schedule.running = false;
    }
  }

  /**
   * Scans PostgreSQL for all active workflows containing a `trigger.cron` node
   * or a configured definition schedule, and registers them.
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

        // Check for explicit schedule in definition
        if (def.schedule && typeof def.schedule === "object") {
          seenIds.add(wf.id);
          this.registerSchedule(wf.id, {
            ownerId: wf.ownerId,
            ...def.schedule,
          });
          registeredCount++;
          continue;
        }

        // Check for trigger.cron node
        const cronNode = (def.nodes || []).find((n) => n.type === "trigger.cron");
        if (cronNode) {
          const config = cronNode.config || {};
          const cronExpr = config.cronExpression || "0 * * * *";
          const timezone = config.timezone || "UTC";
          const enabled = config.enabled !== false;

          seenIds.add(wf.id);
          this.registerSchedule(wf.id, {
            ownerId: wf.ownerId,
            type: "cron",
            cronExpression: cronExpr,
            timezone,
            enabled,
          });
          registeredCount++;
        }
      }

      // Cleanup any schedules that no longer exist in DB
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
   * Synchronizes a single workflow's schedule based on its definition.
   * @param {string} workflowId
   * @param {string} ownerId
   * @param {Object} definition
   */
  syncWorkflowDefinition(workflowId, ownerId, definition) {
    if (!definition || !Array.isArray(definition.nodes)) {
      this.unregisterSchedule(workflowId);
      return;
    }

    // If definition has a schedule configuration
    if (definition.schedule && typeof definition.schedule === "object") {
      this.registerSchedule(workflowId, {
        ownerId,
        ...definition.schedule,
      });
      return;
    }

    const cronNode = definition.nodes.find((n) => n.type === "trigger.cron");
    if (!cronNode) {
      // If was previously registered only as cron without definition schedule, unregister
      const existing = this._schedules.get(workflowId);
      if (existing && existing.type === "cron") {
        this.unregisterSchedule(workflowId);
      }
      return;
    }

    const config = cronNode.config || {};
    const cronExpr = config.cronExpression || "0 * * * *";
    const timezone = config.timezone || "UTC";
    const enabled = config.enabled !== false;

    this.registerSchedule(workflowId, {
      ownerId,
      type: "cron",
      cronExpression: cronExpr,
      timezone,
      enabled,
    });
  }

  /**
   * Evaluates all registered schedules (both interval-based and cron-based).
   * @param {Date} [now=new Date()]
   */
  async tick(now = new Date()) {
    const executedRuns = [];
    const nowMs = now.getTime();
    const curMinuteKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;

    for (const [workflowId, schedule] of this._schedules.entries()) {
      if (!schedule.enabled || schedule.running) {
        continue;
      }

      if (schedule.type === "interval") {
        const intervalMs = (schedule.intervalSeconds || 10) * 1000;
        if (!schedule.lastTickAt || nowMs - schedule.lastTickAt >= intervalMs) {
          schedule.lastTickAt = nowMs;
          const runPromise = this.executeScheduledRun(workflowId, now).catch((err) => {
            console.error(`[CronScheduler] Interval execution failed for '${workflowId}':`, err.message);
          });
          executedRuns.push(runPromise);
        }
      } else if (schedule.type === "cron") {
        if (schedule.lastCronMinuteKey !== curMinuteKey && isCronMatch(schedule.cronExpression, now)) {
          schedule.lastCronMinuteKey = curMinuteKey;
          const runPromise = this.executeScheduledRun(workflowId, now).catch((err) => {
            console.error(`[CronScheduler] Cron execution failed for '${workflowId}':`, err.message);
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
