/**
 * Webster Execution Engine - Local Mock Monitoring & Telemetry Service
 * Provides controlled, deterministic infrastructure telemetry and service health
 * for automated workflow execution, what-if simulations, and judge evaluations.
 */

const express = require("express");

const router = express.Router();

/**
 * Standard Telemetry Database per Service
 */
const SERVICE_TELEMETRY = {
  "payment-gateway": {
    service: "payment-gateway",
    providerHealth: "degraded",
    upstreamStatusCode: 504,
    healthScore: 42,
    p99LatencyMs: 3400,
    errorRateRecent: [0.38, 0.42, 0.48],
    activePods: 12,
    unhealthyPods: 5,
    recentDeployCommit: "c88f21e (fix: pool connection limit)",
    lastDeployTimestamp: "2026-10-25T23:10:00Z",
    recentServiceEvents: [
      "23:10:00Z Deployment c88f21e applied to cluster ap-south-1",
      "23:12:30Z Upstream bank acquirer latency spiked past 3000ms",
      "23:14:00Z Connection pool exhausted; HTTP 504 cascade triggered"
    ],
    onCallEngineer: "devops-lead@enterprise.com",
    cluster: "prod-cluster-04",
    simulatedTelemetry: true,
    telemetrySource: "Dormammu Simulated Metrics Engine (Local Mock)",
  },
  "billing-worker": {
    service: "billing-worker",
    providerHealth: "healthy",
    upstreamStatusCode: 200,
    healthScore: 99,
    p99LatencyMs: 42,
    errorRateRecent: [0.0, 0.0, 0.0],
    activePods: 6,
    unhealthyPods: 0,
    recentDeployCommit: "a12d99f (chore: update invoice templates)",
    lastDeployTimestamp: "2026-10-24T14:00:00Z",
    recentServiceEvents: [
      "22:00:00Z Scheduled cron batch invoice generation completed",
      "22:30:00Z Zero worker errors recorded across all queues"
    ],
    onCallEngineer: "billing-support@enterprise.com",
    cluster: "prod-billing-01",
    simulatedTelemetry: true,
    telemetrySource: "Dormammu Simulated Metrics Engine (Local Mock)",
  },
  "billing": {
    service: "billing",
    providerHealth: "healthy",
    upstreamStatusCode: 200,
    healthScore: 99,
    p99LatencyMs: 42,
    errorRateRecent: [0.0, 0.0, 0.0],
    activePods: 6,
    unhealthyPods: 0,
    recentDeployCommit: "a12d99f (chore: update invoice templates)",
    lastDeployTimestamp: "2026-10-24T14:00:00Z",
    recentServiceEvents: [
      "22:00:00Z Scheduled cron batch invoice generation completed",
      "22:30:00Z Zero worker errors recorded across all queues"
    ],
    onCallEngineer: "billing-support@enterprise.com",
    cluster: "prod-billing-01",
    simulatedTelemetry: true,
    telemetrySource: "Dormammu Simulated Metrics Engine (Local Mock)",
  },
  "auth-service": {
    service: "auth-service",
    providerHealth: "warning",
    upstreamStatusCode: 408,
    healthScore: 71,
    p99LatencyMs: 780,
    errorRateRecent: [0.04, 0.06, 0.08],
    activePods: 8,
    unhealthyPods: 2,
    recentDeployCommit: "f77c301 (feat: session duration extension)",
    lastDeployTimestamp: "2026-10-25T18:00:00Z",
    recentServiceEvents: [
      "23:00:00Z Redis cluster replica node-2 restart",
      "23:05:00Z Cache miss rate elevated to 41.2%"
    ],
    onCallEngineer: "secops@enterprise.com",
    cluster: "prod-auth-02",
    simulatedTelemetry: true,
    telemetrySource: "Dormammu Simulated Metrics Engine (Local Mock)",
  },
  "checkout-api": {
    service: "checkout-api",
    providerHealth: "warning",
    upstreamStatusCode: 200,
    healthScore: 68,
    p99LatencyMs: 2100,
    errorRateRecent: [0.01, 0.01, 0.01],
    activePods: 16,
    unhealthyPods: 3,
    recentDeployCommit: "e34b122 (refactor: cart checkout serializer)",
    lastDeployTimestamp: "2026-10-25T21:00:00Z",
    recentServiceEvents: [
      "23:15:00Z Query response time on db-pool spiked to 1980ms"
    ],
    onCallEngineer: "checkout-sre@enterprise.com",
    cluster: "prod-checkout-01",
    simulatedTelemetry: true,
    telemetrySource: "Dormammu Simulated Metrics Engine (Local Mock)",
  },
};

/**
 * GET /api/mock/monitoring/services/:service
 * GET /api/mock/service-health/:service
 */
function handleServiceHealth(req, res) {
  const service = String(req.params.service || "general").toLowerCase();
  const simulateError = req.query.simulateError === "true" ||
    service === "fail-service" ||
    service === "nonexistent-failing-service";

  if (simulateError) {
    return res.status(503).json({
      error: "Controlled dependency failure: Upstream monitoring provider returned HTTP 503 Service Unavailable",
      service,
      status: "down",
      providerHealth: "down",
      simulatedTelemetry: true,
      timestamp: new Date().toISOString(),
    });
  }

  const data = SERVICE_TELEMETRY[service] || {
    service,
    providerHealth: "warning",
    upstreamStatusCode: 200,
    healthScore: 75,
    p99LatencyMs: 120,
    errorRateRecent: [0.01, 0.02, 0.01],
    activePods: 4,
    unhealthyPods: 1,
    recentDeployCommit: "b0099aa (chore: standard update)",
    lastDeployTimestamp: "2026-10-25T12:00:00Z",
    recentServiceEvents: ["Routine operations nominal"],
    onCallEngineer: "support-lead@enterprise.com",
    cluster: "general-01",
    simulatedTelemetry: true,
    telemetrySource: "Dormammu Simulated Metrics Engine (Local Mock)",
  };

  return res.status(200).json({
    ...data,
    timestamp: new Date().toISOString(),
  });
}

router.get("/service-health/:service", handleServiceHealth);
router.get("/monitoring/services/:service", handleServiceHealth);

module.exports = router;
