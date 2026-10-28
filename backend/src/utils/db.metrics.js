/**
 * Dormammu Engine - PostgreSQL Query & Performance Metrics Collector
 * Instruments query execution frequency, latency distributions, and N+1 prevention metrics.
 */

class DatabaseMetricsCollector {
  constructor() {
    this.reset();
  }

  reset() {
    this.totalQueries = 0;
    this.totalDurationMs = 0;
    this.queriesByOperation = {
      findUnique: 0,
      findFirst: 0,
      findMany: 0,
      create: 0,
      createMany: 0,
      update: 0,
      updateMany: 0,
      delete: 0,
      deleteMany: 0,
      transaction: 0,
      other: 0,
    };
    this.queriesByModel = {};
    this.recentSlowQueries = [];
    this.activeRunMetrics = new Map(); // runId -> { queryCount, durationMs, startedAt }
  }

  /**
   * Records a database operation.
   * @param {string} model
   * @param {string} operation
   * @param {number} durationMs
   * @param {string} [runId]
   */
  recordQuery(model = "unknown", operation = "other", durationMs = 0, runId = null) {
    this.totalQueries++;
    this.totalDurationMs += durationMs;

    if (this.queriesByOperation[operation] !== undefined) {
      this.queriesByOperation[operation]++;
    } else {
      this.queriesByOperation.other++;
    }

    if (!this.queriesByModel[model]) {
      this.queriesByModel[model] = 0;
    }
    this.queriesByModel[model]++;

    if (durationMs > 100) {
      if (this.recentSlowQueries.length >= 50) {
        this.recentSlowQueries.shift();
      }
      this.recentSlowQueries.push({
        model,
        operation,
        durationMs,
        timestamp: new Date().toISOString(),
      });
    }

    if (runId) {
      if (!this.activeRunMetrics.has(runId)) {
        this.activeRunMetrics.set(runId, { queryCount: 0, durationMs: 0, startedAt: Date.now() });
      }
      const entry = this.activeRunMetrics.get(runId);
      entry.queryCount++;
      entry.durationMs += durationMs;
    }
  }

  /**
   * Retrieves summary report of database activity.
   */
  getMetricsSummary() {
    const avgLatencyMs = this.totalQueries > 0 ? (this.totalDurationMs / this.totalQueries).toFixed(2) : 0;
    return {
      totalQueries: this.totalQueries,
      totalDurationMs: Math.round(this.totalDurationMs),
      avgLatencyMs: Number(avgLatencyMs),
      queriesByOperation: { ...this.queriesByOperation },
      queriesByModel: { ...this.queriesByModel },
      slowQueriesCount: this.recentSlowQueries.length,
    };
  }

  /**
   * Returns query count and duration for a specific run.
   * @param {string} runId
   */
  getRunMetrics(runId) {
    return this.activeRunMetrics.get(runId) || { queryCount: 0, durationMs: 0 };
  }
}

const defaultDbMetrics = new DatabaseMetricsCollector();

module.exports = {
  DatabaseMetricsCollector,
  defaultDbMetrics,
  getDbMetrics: () => defaultDbMetrics.getMetricsSummary(),
  resetDbMetrics: () => defaultDbMetrics.reset(),
};
