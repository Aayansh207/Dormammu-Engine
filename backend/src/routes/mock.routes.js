/**
 * Webster Execution Engine - Local Mock Service Health Routes
 * Provides controlled, deterministic service-dependency responses for workflow testing and live demos.
 */

const express = require("express");

const router = express.Router();

router.get("/service-health/:service", (req, res) => {
  const service = req.params.service || "general";
  const simulateError = req.query.simulateError === "true" || service === "fail-service";

  if (simulateError) {
    return res.status(500).json({
      error: "Controlled dependency failure: Service unavailable (HTTP 500)",
      service,
      status: "down",
      timestamp: new Date().toISOString(),
    });
  }

  if (service === "payment-gateway") {
    return res.status(200).json({
      service: "payment-gateway",
      status: "degraded",
      healthScore: 45,
      incidentCount24h: 3,
      region: "ap-south-1",
      onCallEngineer: "devops-lead@enterprise.com",
      cluster: "prod-cluster-04",
      timestamp: new Date().toISOString(),
    });
  }

  if (service === "billing") {
    return res.status(200).json({
      service: "billing",
      status: "healthy",
      healthScore: 99,
      incidentCount24h: 0,
      region: "ap-south-1",
      onCallEngineer: "billing-support@enterprise.com",
      cluster: "prod-billing-01",
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(200).json({
    service,
    status: "warning",
    healthScore: 72,
    incidentCount24h: 1,
    region: "ap-south-1",
    onCallEngineer: "support-lead@enterprise.com",
    cluster: "general-01",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
