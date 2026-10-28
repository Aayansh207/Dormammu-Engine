import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Play,
  Pause,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Flame,
  AlertCircle,
  Sparkles,
  Sliders,
  History,
  Timer
} from "lucide-react";
import { api } from "../../services/api";

const PRESET_INTERVALS = [
  { label: "5s", value: 5, unit: "seconds" },
  { label: "10s", value: 10, unit: "seconds" },
  { label: "15s", value: 15, unit: "seconds" },
  { label: "30s", value: 30, unit: "seconds" },
  { label: "1m", value: 60, unit: "seconds" },
  { label: "5m", value: 300, unit: "seconds" },
  { label: "15m", value: 900, unit: "seconds" },
];

const PAYLOAD_PRESETS = {
  standard: {
    incident_id: "INC-8092",
    service: "payment-gateway",
    errorRate: 0.12,
    affectedUsers: 1400,
    severity: "warning",
    region: "us-east-1",
    customerTier: "enterprise",
    telemetry: { cpuLoad: 88, memoryUsage: 76 }
  },
  critical: {
    incident_id: "INC-9911",
    service: "auth-cluster",
    errorRate: 0.85,
    affectedUsers: 48000,
    severity: "critical",
    region: "eu-west-1",
    customerTier: "enterprise",
    telemetry: { cpuLoad: 99, podRestarts: 14 }
  },
  degraded: {
    incident_id: "INC-4102",
    service: "search-indexer",
    errorRate: 0.04,
    affectedUsers: 320,
    severity: "normal",
    region: "ap-southeast-1",
    customerTier: "standard",
    telemetry: { latencyP99Ms: 420 }
  },
  failingTest: {
    incident_id: "INC-INVALID-TEST",
    errorRate: "NOT_A_NUMBER_WILL_FAIL", // Triggers data.validate error
    affectedUsers: -9999, // Fails boundary validation
    service: "" // Empty service fails required check
  }
};

export default function AutoIncidentTriggerModal({
  isOpen,
  onClose,
  workflow,
  onOpenReport,
  onTriggerTick,
  onTriggerError,
  externalActiveState = null,
  onActiveStateChange = null,
}) {
  const workflowId = workflow?.id;
  const workflowName = workflow?.name || "Workflow";

  // Configuration state
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [customUnit, setCustomUnit] = useState("seconds"); // "seconds" | "minutes"
  const [customValue, setCustomValue] = useState(10);
  const [payloadInput, setPayloadInput] = useState("");
  const [stopOnError, setStopOnError] = useState(true);
  const [autoRotateIncidentId, setAutoRotateIncidentId] = useState(true);

  // Runtime & Execution state
  const [isActive, setIsActive] = useState(false);
  const [isExecutingNow, setIsExecutingNow] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [runHistory, setRunHistory] = useState([]);
  const [lastError, setLastError] = useState(null);
  const [lastSuccess, setLastSuccess] = useState(null);
  const [stats, setStats] = useState({ total: 0, passed: 0, failed: 0 });
  const [jsonError, setJsonError] = useState(null);

  const countdownTimerRef = useRef(null);
  const lastTickTimestampRef = useRef(Date.now());
  const tickCounterRef = useRef(1);

  // Sync with external active state if provided
  useEffect(() => {
    if (externalActiveState !== null && externalActiveState !== undefined) {
      setIsActive(Boolean(externalActiveState));
    }
  }, [externalActiveState]);

  // Helper to infer appropriate default payload from workflow definition
  const resolveDefaultWorkflowPayload = () => {
    const sample = workflow?.definition?.samplePayload || workflow?.samplePayload;
    if (sample && typeof sample === "object" && Object.keys(sample).length > 0) {
      return sample;
    }
    const allNodes = workflow?.definition?.nodes || workflow?.nodes || [];
    const manualTriggers = allNodes.filter((n) => n.type === "trigger.manual");
    if (manualTriggers.length > 1) {
      const multi = { $multiTrigger: true, $triggerIds: [], $triggers: [] };
      manualTriggers.forEach((trig, idx) => {
        const val = trig.config?.defaultPayload !== undefined && trig.config.defaultPayload !== ""
          ? trig.config.defaultPayload
          : (idx + 1) * 10;
        multi[trig.id] = val;
        multi[`trigger_${idx}`] = val;
        multi.$triggerIds.push(trig.id);
        multi.$triggers.push(val);
      });
      return multi;
    }
    if (manualTriggers.length === 1) {
      const defVal = manualTriggers[0]?.config?.defaultPayload !== undefined && manualTriggers[0]?.config?.defaultPayload !== ""
        ? manualTriggers[0].config.defaultPayload
        : 10;
      return defVal;
    }
    const dataInputs = allNodes.filter((n) => n.type === "data.input");
    if (dataInputs.length > 0) {
      const inObj = {};
      dataInputs.forEach((din) => {
        const k = din.config?.key || "input";
        inObj[k] = din.config?.defaultValue !== undefined ? din.config.defaultValue : 10;
      });
      return inObj;
    }
    return PAYLOAD_PRESETS.standard;
  };

  // Initial load: fetch schedule from backend or populate from sample payload
  useEffect(() => {
    if (!isOpen || !workflowId) return;

    let isMounted = true;

    async function loadSchedule() {
      try {
        const res = await api.getWorkflowSchedule(workflowId);
        if (isMounted && res?.data) {
          const s = res.data;
          if (s.intervalSeconds) {
            setIntervalSeconds(s.intervalSeconds);
            if (s.intervalSeconds % 60 === 0 && s.intervalSeconds >= 60) {
              setCustomUnit("minutes");
              setCustomValue(s.intervalSeconds / 60);
            } else {
              setCustomUnit("seconds");
              setCustomValue(s.intervalSeconds);
            }
          }
          if (s.stopOnError !== undefined) setStopOnError(Boolean(s.stopOnError));
          if (s.enabled !== undefined) {
            setIsActive(Boolean(s.enabled));
            if (onActiveStateChange) onActiveStateChange(Boolean(s.enabled));
          }
          if (s.lastError) setLastError(s.lastError);
          if (s.payload !== undefined && s.payload !== null && (typeof s.payload === "number" || Object.keys(s.payload).length > 0)) {
            setPayloadInput(typeof s.payload === "object" ? JSON.stringify(s.payload, null, 2) : String(s.payload));
          } else {
            const defSample = resolveDefaultWorkflowPayload();
            setPayloadInput(typeof defSample === "object" ? JSON.stringify(defSample, null, 2) : String(defSample));
          }
        }
      } catch (err) {
        // Fallback to sample or trigger payload
        const defSample = resolveDefaultWorkflowPayload();
        setPayloadInput(typeof defSample === "object" ? JSON.stringify(defSample, null, 2) : String(defSample));
      }
    }

    loadSchedule();

    return () => {
      isMounted = false;
    };
  }, [isOpen, workflowId]);

  // Real-time Countdown & Execution Loop
  useEffect(() => {
    if (!isActive) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      setCountdown(intervalSeconds);
      return;
    }

    setCountdown(intervalSeconds);
    lastTickTimestampRef.current = Date.now();

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger the incident run!
          executeIncidentTick();
          return intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [isActive, intervalSeconds]);

  // Execute a single incident tick
  const executeIncidentTick = async () => {
    if (isExecutingNow) return;
    setIsExecutingNow(true);

    const allNodes = workflow?.definition?.nodes || workflow?.nodes || [];
    const manualTriggers = allNodes.filter((n) => n.type === "trigger.manual");

    let parsedPayload;
    const trimmedInput = payloadInput ? payloadInput.trim() : "";
    if (trimmedInput === "") {
      parsedPayload = resolveDefaultWorkflowPayload();
    } else {
      try {
        parsedPayload = JSON.parse(trimmedInput);
      } catch (parseErr) {
        if (!isNaN(Number(trimmedInput))) {
          parsedPayload = Number(trimmedInput);
        } else {
          parsedPayload = trimmedInput;
        }
      }
    }

    // Auto-rotate Incident ID & timestamp if enabled AND payload is a JSON object
    const tickSeq = tickCounterRef.current++;
    const nowIso = new Date().toISOString();
    let finalPayload;
    if (typeof parsedPayload === "object" && parsedPayload !== null && !Array.isArray(parsedPayload)) {
      finalPayload = {
        ...parsedPayload,
        ...(autoRotateIncidentId && (parsedPayload.incident_id || manualTriggers.length === 0)
          ? {
              incident_id: `${parsedPayload.incident_id ? parsedPayload.incident_id.replace(/-T\d+$/, "") : "INC-AUTO"}-T${String(tickSeq).padStart(3, "0")}`,
              timestamp: nowIso,
              reportGeneratedAt: nowIso,
            }
          : { timestamp: parsedPayload.timestamp || nowIso }),
        $scheduledIncident: true,
        $intervalSeconds: intervalSeconds,
      };

      // If workflow has multiple manual triggers and finalPayload is not partitioned, ensure multiTrigger mappings
      if (manualTriggers.length > 1 && !finalPayload.$multiTrigger) {
        finalPayload.$multiTrigger = true;
        if (!finalPayload.$triggerIds) finalPayload.$triggerIds = [];
        if (!finalPayload.$triggers) finalPayload.$triggers = [];
        manualTriggers.forEach((trig, idx) => {
          if (finalPayload[trig.id] === undefined) {
            const val = trig.config?.defaultPayload !== undefined && trig.config.defaultPayload !== ""
              ? trig.config.defaultPayload
              : (idx + 1) * 10;
            finalPayload[trig.id] = val;
            finalPayload[`trigger_${idx}`] = val;
            finalPayload.$triggerIds.push(trig.id);
            finalPayload.$triggers.push(val);
          }
        });
      }
    } else {
      finalPayload = parsedPayload;
    }

    try {
      const response = await api.executeWorkflow(workflowId, {
        triggerData: finalPayload,
      });

      const run = response?.data;
      if (!run) throw new Error("Empty execution response received from server");

      const isFailed = run.status === "FAILED";
      const failureError = isFailed
        ? run.error || {
            code: "EXECUTION_FAILED",
            message: "Workflow execution failed at one or more nodes",
          }
        : null;

      const record = {
        id: run.id || run.runId,
        incidentId: finalPayload.incident_id,
        timestamp: new Date().toLocaleTimeString(),
        status: run.status,
        durationMs: run.durationMs || 0,
        error: failureError,
        finalOutput: run.finalOutput,
      };

      setRunHistory((prev) => [record, ...prev.slice(0, 19)]);
      setStats((prev) => ({
        total: prev.total + 1,
        passed: prev.passed + (isFailed ? 0 : 1),
        failed: prev.failed + (isFailed ? 1 : 0),
      }));

      if (isFailed) {
        // Find specific failed node if available
        let failedNodeName = null;
        if (run.tasks) {
          const failedTask = Object.values(run.tasks).find((t) => t.status === "FAILED");
          if (failedTask) {
            failedNodeName = failedTask.nodeName || failedTask.nodeId;
          }
        }

        const enrichedError = {
          code: failureError.code || "EXECUTION_FAILED",
          message: failureError.message || "Incident execution failed",
          nodeName: failedNodeName,
          runId: run.id || run.runId,
          timestamp: new Date().toLocaleTimeString(),
        };

        setLastError(enrichedError);

        if (onTriggerError) {
          onTriggerError(enrichedError);
        }

        if (stopOnError) {
          setIsActive(false);
          if (onActiveStateChange) onActiveStateChange(false);
          // Sync pause to backend
          api.updateWorkflowSchedule(workflowId, {
            enabled: false,
            intervalSeconds,
            payload: parsedPayload,
            stopOnError,
          }).catch(() => {});
        }
      } else {
        setLastSuccess({
          runId: run.id || run.runId,
          incidentId: finalPayload.incident_id,
          durationMs: run.durationMs,
          timestamp: new Date().toLocaleTimeString(),
        });
        if (onTriggerTick) {
          onTriggerTick(record);
        }
      }
    } catch (err) {
      const errorObj = {
        code: err.code || "TRIGGER_NETWORK_ERROR",
        message: err.message || "Failed to trigger incident workflow",
        runId: null,
        timestamp: new Date().toLocaleTimeString(),
      };
      setLastError(errorObj);
      setRunHistory((prev) => [
        {
          id: "err-" + Date.now(),
          incidentId: finalPayload.incident_id,
          timestamp: new Date().toLocaleTimeString(),
          status: "FAILED",
          durationMs: 0,
          error: errorObj,
        },
        ...prev.slice(0, 19),
      ]);
      setStats((prev) => ({
        ...prev,
        total: prev.total + 1,
        failed: prev.failed + 1,
      }));

      if (onTriggerError) {
        onTriggerError(errorObj);
      }

      if (stopOnError) {
        setIsActive(false);
        if (onActiveStateChange) onActiveStateChange(false);
      }
    } finally {
      setIsExecutingNow(false);
    }
  };

  // Toggle active state
  const handleToggleActive = async () => {
    const nextState = !isActive;
    setIsActive(nextState);
    if (onActiveStateChange) onActiveStateChange(nextState);

    // If starting, clear previous errors and trigger first run immediately
    if (nextState) {
      setLastError(null);
      setCountdown(intervalSeconds);
      executeIncidentTick();
    }

    // Sync to backend scheduler
    try {
      let parsed = {};
      const trimmed = payloadInput ? payloadInput.trim() : "";
      if (trimmed === "") {
        parsed = resolveDefaultWorkflowPayload();
      } else {
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {
          if (!isNaN(Number(trimmed))) {
            parsed = Number(trimmed);
          } else {
            parsed = trimmed;
          }
        }
      }

      await api.updateWorkflowSchedule(workflowId, {
        enabled: nextState,
        intervalSeconds,
        type: "interval",
        payload: parsed,
        stopOnError,
      });
    } catch (err) {
      console.warn("Could not sync schedule to server:", err.message);
    }
  };

  // Handle preset interval selection
  const handleSelectPreset = (sec) => {
    setIntervalSeconds(sec);
    setCustomValue(sec >= 60 && sec % 60 === 0 ? sec / 60 : sec);
    setCustomUnit(sec >= 60 && sec % 60 === 0 ? "minutes" : "seconds");
    if (isActive) {
      setCountdown(sec);
    }
  };

  // Handle custom interval change
  const handleCustomChange = (val, unit) => {
    const num = Math.max(2, parseInt(val, 10) || 2);
    setCustomValue(num);
    const secs = unit === "minutes" ? num * 60 : num;
    setIntervalSeconds(secs);
    if (isActive) {
      setCountdown(secs);
    }
  };

  // Load a payload preset
  const handleLoadPayloadPreset = (presetKey) => {
    const data = PAYLOAD_PRESETS[presetKey];
    if (data) {
      setPayloadInput(JSON.stringify(data, null, 2));
      setJsonError(null);
    }
  };

  if (!isOpen) return null;

  const progressPercent = Math.max(0, Math.min(100, ((intervalSeconds - countdown) / intervalSeconds) * 100));

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "760px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: "16px",
          border: isActive
            ? "1px solid rgba(16, 185, 129, 0.4)"
            : lastError
            ? "1px solid rgba(244, 63, 94, 0.4)"
            : "1px solid rgba(255, 255, 255, 0.12)",
          boxShadow: isActive
            ? "0 20px 60px rgba(16, 185, 129, 0.2), 0 0 30px rgba(0, 0, 0, 0.8)"
            : lastError
            ? "0 20px 60px rgba(244, 63, 94, 0.25), 0 0 30px rgba(0, 0, 0, 0.8)"
            : "0 25px 60px rgba(0, 0, 0, 0.9)",
          transition: "border 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255, 255, 255, 0.02)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: isActive
                  ? "linear-gradient(135deg, #10b981, #059669)"
                  : lastError
                  ? "linear-gradient(135deg, #f43f5e, #be123c)"
                  : "linear-gradient(135deg, #39AEA9, #557B83)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: isActive ? "0 0 16px rgba(16, 185, 129, 0.5)" : "none",
                animation: isActive ? "pulse 2s infinite" : "none",
              }}
            >
              <Timer size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "700", color: "#f8fafc" }}>
                  Automated Incident Trigger
                </h3>
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: "800",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    letterSpacing: "0.5px",
                    textTransform: "uppercase",
                    background: isActive
                      ? "rgba(16, 185, 129, 0.18)"
                      : lastError
                      ? "rgba(244, 63, 94, 0.18)"
                      : "rgba(148, 163, 184, 0.15)",
                    color: isActive
                      ? "#34d399"
                      : lastError
                      ? "#fb7185"
                      : "var(--text-muted)",
                    border: `1px solid ${
                      isActive
                        ? "rgba(16, 185, 129, 0.35)"
                        : lastError
                        ? "rgba(244, 63, 94, 0.35)"
                        : "rgba(148, 163, 184, 0.25)"
                    }`,
                  }}
                >
                  {isActive ? "🟢 Active Running" : lastError ? "🔴 Failed / Stopped" : "⏸️ Idle"}
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                Recurring autonomous incident telemetry injector for <strong>{workflowName}</strong>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s ease",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          {/* URGENT ERROR ALERT BANNER: Shown if ANY execution fails */}
          {lastError && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(136, 19, 55, 0.25) 100%)",
                border: "1.5px solid #f43f5e",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                boxShadow: "0 8px 24px rgba(244, 63, 94, 0.25)",
                animation: "fadeIn 0.25s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      background: "rgba(244, 63, 94, 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <AlertTriangle size={18} color="#f43f5e" />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.95rem", fontWeight: "800", color: "#fecdd3" }}>
                        🚨 Incident Execution Failed!
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          fontWeight: "800",
                          background: "#f43f5e",
                          color: "#ffffff",
                          padding: "1px 6px",
                          borderRadius: "4px",
                        }}
                      >
                        {lastError.code}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "#ffe4e6", marginTop: "4px", lineHeight: "1.4" }}>
                      {lastError.message}
                    </p>
                    {lastError.nodeName && (
                      <div style={{ fontSize: "0.74rem", color: "#fca5a5", marginTop: "4px" }}>
                        💥 Failing Node: <strong>{lastError.nodeName}</strong>
                      </div>
                    )}
                    <div style={{ fontSize: "0.7rem", color: "#f87171", marginTop: "2px" }}>
                      Occurred at: {lastError.timestamp} {lastError.runId ? `• Run ID: ${lastError.runId}` : ""}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                  {lastError.runId && onOpenReport && (
                    <button
                      onClick={() => onOpenReport(lastError.runId)}
                      style={{
                        padding: "6px 12px",
                        background: "rgba(255, 255, 255, 0.12)",
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                        borderRadius: "6px",
                        color: "#ffffff",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <ExternalLink size={13} />
                      Inspect Report
                    </button>
                  )}
                  <button
                    onClick={() => setLastError(null)}
                    style={{
                      padding: "4px 8px",
                      background: "transparent",
                      border: "none",
                      color: "#fca5a5",
                      fontSize: "0.72rem",
                      cursor: "pointer",
                      textAlign: "right",
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* URGENT SUCCESS BANNER: Shown when last incident execution SUCCEEDED */}
          {lastSuccess && !lastError && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(6, 78, 59, 0.28) 100%)",
                border: "1.5px solid #10b981",
                borderRadius: "12px",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "12px",
                boxShadow: "0 8px 24px rgba(16, 185, 129, 0.22)",
                animation: "fadeIn 0.25s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "rgba(16, 185, 129, 0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle2 size={18} color="#10b981" />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "0.92rem", fontWeight: "800", color: "#a7f3d0" }}>
                      ✅ Incident Run Succeeded!
                    </span>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: "800",
                        background: "#10b981",
                        color: "#ffffff",
                        padding: "1px 6px",
                        borderRadius: "4px",
                      }}
                    >
                      SUCCEEDED
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      ⚡ {lastSuccess.durationMs}ms
                    </span>
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "#d1fae5", marginTop: "3px" }}>
                    Incident <strong>{lastSuccess.incidentId}</strong> executed healthy at {lastSuccess.timestamp}
                    {lastSuccess.runId ? ` • Run ID: ${lastSuccess.runId}` : ""}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                {lastSuccess.runId && onOpenReport && (
                  <button
                    type="button"
                    onClick={() => onOpenReport(lastSuccess.runId)}
                    style={{
                      padding: "6px 12px",
                      background: "rgba(16, 185, 129, 0.2)",
                      border: "1px solid rgba(16, 185, 129, 0.4)",
                      borderRadius: "6px",
                      color: "#ffffff",
                      fontSize: "0.74rem",
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <ExternalLink size={13} />
                    Inspect Report
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setLastSuccess(null)}
                  style={{
                    padding: "4px 8px",
                    background: "transparent",
                    border: "none",
                    color: "#a7f3d0",
                    fontSize: "0.72rem",
                    cursor: "pointer",
                  }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* ACTIVE STATUS TELEMETRY & COUNTDOWN BAR */}
          {isActive && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(6, 78, 59, 0.2) 100%)",
                border: "1px solid rgba(16, 185, 129, 0.35)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      background: "#10b981",
                      boxShadow: "0 0 10px #10b981",
                      animation: "pulse 1.5s infinite",
                    }}
                  />
                  <div>
                    <div style={{ fontSize: "0.88rem", fontWeight: "700", color: "#34d399" }}>
                      Auto-Trigger Active: Every {intervalSeconds} Seconds
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                      Next incident payload will be dispatched in <strong>{countdown}s</strong>
                    </div>
                  </div>
                </div>

                {isExecutingNow && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "0.75rem",
                      color: "#38bdf8",
                      fontWeight: "700",
                    }}
                  >
                    <RefreshCw size={13} className="animate-spin" />
                    Dispatching Run...
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div
                style={{
                  height: "6px",
                  width: "100%",
                  background: "rgba(255, 255, 255, 0.08)",
                  borderRadius: "3px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${progressPercent}%`,
                    background: "linear-gradient(90deg, #39AEA9, #10b981)",
                    borderRadius: "3px",
                    transition: "width 1s linear",
                  }}
                />
              </div>

              {/* Quick stats row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px",
                  fontSize: "0.75rem",
                  paddingTop: "4px",
                }}
              >
                <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "6px 10px", borderRadius: "6px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total Triggered:</span>{" "}
                  <strong style={{ color: "#f8fafc" }}>{stats.total}</strong>
                </div>
                <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "6px 10px", borderRadius: "6px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Succeeded:</span>{" "}
                  <strong style={{ color: "#34d399" }}>{stats.passed}</strong>
                </div>
                <div style={{ background: "rgba(0, 0, 0, 0.2)", padding: "6px 10px", borderRadius: "6px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Failed:</span>{" "}
                  <strong style={{ color: stats.failed > 0 ? "#f43f5e" : "#f8fafc" }}>{stats.failed}</strong>
                </div>
              </div>
            </div>
          )}

          {/* Section 1: Specific Intervals of Time Decided by User */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={15} color="var(--brand)" />
                Trigger Interval (Decided by User)
              </label>
              <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                Selected: <strong style={{ color: "var(--brand)" }}>{intervalSeconds} seconds</strong> ({intervalSeconds < 60 ? `${intervalSeconds}s` : `${(intervalSeconds / 60).toFixed(1)}m`})
              </span>
            </div>

            {/* Presets Grid */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {PRESET_INTERVALS.map((preset) => {
                const isSelected = intervalSeconds === preset.value;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleSelectPreset(preset.value)}
                    style={{
                      flex: "1 1 calc(14% - 8px)",
                      minWidth: "60px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "0.82rem",
                      fontWeight: isSelected ? "800" : "600",
                      background: isSelected
                        ? "linear-gradient(135deg, rgba(57, 174, 169, 0.3) 0%, rgba(16, 185, 129, 0.3) 100%)"
                        : "var(--bg-secondary)",
                      color: isSelected ? "var(--brand)" : "var(--text-secondary)",
                      border: isSelected ? "1.5px solid var(--brand)" : "1px solid var(--border-subtle)",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      textAlign: "center",
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Custom Interval Row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "rgba(255, 255, 255, 0.02)",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)", flexShrink: 0 }}>
                Custom Interval:
              </span>
              <input
                type="number"
                min="2"
                max="86400"
                value={customValue}
                onChange={(e) => handleCustomChange(e.target.value, customUnit)}
                style={{
                  width: "80px",
                  padding: "5px 8px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  fontSize: "0.82rem",
                  fontWeight: "600",
                  textAlign: "center",
                }}
              />
              <select
                value={customUnit}
                onChange={(e) => handleCustomChange(customValue, e.target.value)}
                style={{
                  padding: "5px 10px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  color: "#f8fafc",
                  fontSize: "0.82rem",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                <option value="seconds">Seconds</option>
                <option value="minutes">Minutes</option>
              </select>
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                Auto-fires incident run sequentially at this rate
              </span>
            </div>
          </div>

          {/* Section 2: Incident Telemetry Payload & Presets */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
                <Zap size={15} color="#38bdf8" />
                Incident Payload Ingestion
              </label>

              {/* Quick Template Buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Templates:</span>
                <button
                  type="button"
                  onClick={() => handleLoadPayloadPreset("standard")}
                  style={{
                    fontSize: "0.7rem",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                  title="Standard healthy incident payload"
                >
                  Standard
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadPayloadPreset("critical")}
                  style={{
                    fontSize: "0.7rem",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: "rgba(244, 63, 94, 0.15)",
                    border: "1px solid rgba(244, 63, 94, 0.3)",
                    color: "#f43f5e",
                    cursor: "pointer",
                    fontWeight: "700",
                  }}
                  title="High-severity outage payload"
                >
                  Critical Outage
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadPayloadPreset("degraded")}
                  style={{
                    fontSize: "0.7rem",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.3)",
                    color: "#f59e0b",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                  title="Warning degradation payload"
                >
                  Warning
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadPayloadPreset("failingTest")}
                  style={{
                    fontSize: "0.7rem",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: "rgba(225, 29, 72, 0.2)",
                    border: "1px solid rgba(225, 29, 72, 0.45)",
                    color: "#fda4af",
                    cursor: "pointer",
                    fontWeight: "700",
                  }}
                  title="Injects invalid data to test error detection & alerts"
                >
                  💥 Test Failure Error
                </button>
              </div>
            </div>

            <textarea
              rows={6}
              value={payloadInput}
              onChange={(e) => {
                setPayloadInput(e.target.value);
                setJsonError(null);
              }}
              placeholder='{\n  "incident_id": "INC-8092",\n  "service": "payment-gateway",\n  "errorRate": 0.15\n}'
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "var(--bg-input)",
                border: jsonError ? "1px solid #f43f5e" : "1px solid var(--border-subtle)",
                borderRadius: "8px",
                color: "#f8fafc",
                fontSize: "0.82rem",
                fontFamily: "var(--font-mono)",
                lineHeight: "1.4",
                outline: "none",
                resize: "vertical",
              }}
            />
            {jsonError && (
              <span style={{ fontSize: "0.72rem", color: "#f43f5e", display: "flex", alignItems: "center", gap: "4px" }}>
                <AlertCircle size={12} />
                {jsonError}
              </span>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem", color: "var(--text-muted)" }}>
              <input
                type="checkbox"
                id="autoRotate"
                checked={autoRotateIncidentId}
                onChange={(e) => setAutoRotateIncidentId(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <label htmlFor="autoRotate" style={{ cursor: "pointer" }}>
                Auto-generate fresh Incident ID (e.g. <code>INC-AUTO-T001</code>) and ISO timestamp on each interval tick
              </label>
            </div>
          </div>

          {/* Section 3: Safety Guardrails & Error Policy */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ fontSize: "0.8rem", fontWeight: "700", color: "#f8fafc", display: "flex", alignItems: "center", gap: "6px" }}>
              <ShieldAlert size={14} color="#f59e0b" />
              Error Detection &amp; Safety Policy
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.75rem", color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                id="stopOnError"
                checked={stopOnError}
                onChange={(e) => setStopOnError(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <label htmlFor="stopOnError" style={{ cursor: "pointer" }}>
                <strong>Pause auto-trigger immediately on any failure</strong> (shows prominent error banner with failed node details and prevents runaway error loops)
              </label>
            </div>
          </div>

          {/* Section 4: Live Execution History */}
          {runHistory.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "5px" }}>
                  <History size={13} />
                  Trigger History (Last {runHistory.length} Runs)
                </span>
                <button
                  type="button"
                  onClick={() => setRunHistory([])}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-muted)",
                    fontSize: "0.7rem",
                    cursor: "pointer",
                  }}
                >
                  Clear History
                </button>
              </div>

              <div
                style={{
                  maxHeight: "150px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  background: "var(--bg-input)",
                  padding: "8px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                {runHistory.map((run, idx) => (
                  <div
                    key={run.id + idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      background: run.status === "FAILED" ? "rgba(244, 63, 94, 0.1)" : "rgba(16, 185, 129, 0.08)",
                      border: `1px solid ${run.status === "FAILED" ? "rgba(244, 63, 94, 0.25)" : "rgba(16, 185, 129, 0.2)"}`,
                      fontSize: "0.74rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {run.status === "FAILED" ? (
                        <XCircle size={14} color="#f43f5e" />
                      ) : (
                        <CheckCircle2 size={14} color="#10b981" />
                      )}
                      <div>
                        <strong style={{ color: "#f8fafc" }}>{run.incidentId || "INCIDENT"}</strong>
                        <span style={{ color: "var(--text-muted)", marginLeft: "6px" }}>at {run.timestamp}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ color: "var(--text-muted)" }}>{run.durationMs}ms</span>
                      <span
                        style={{
                          fontWeight: "700",
                          color: run.status === "FAILED" ? "#f43f5e" : "#10b981",
                        }}
                      >
                        {run.status}
                      </span>
                      {run.id && !run.id.startsWith("err-") && onOpenReport && (
                        <button
                          type="button"
                          onClick={() => onOpenReport(run.id)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--brand)",
                            cursor: "pointer",
                            padding: "2px",
                            display: "flex",
                            alignItems: "center",
                          }}
                          title="Open full execution report"
                        >
                          <ExternalLink size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid var(--border-subtle)",
            background: "rgba(255, 255, 255, 0.02)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={executeIncidentTick}
              disabled={isExecutingNow}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                fontSize: "0.82rem",
                fontWeight: "600",
                cursor: isExecutingNow ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              title="Dispatches one incident run immediately without starting recurrent timer"
            >
              <Zap size={14} color="#38bdf8" />
              {isExecutingNow ? "Triggering..." : "Trigger Once Now"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                color: "var(--text-secondary)",
                fontSize: "0.85rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Close
            </button>

            <button
              type="button"
              onClick={handleToggleActive}
              style={{
                padding: "8px 22px",
                borderRadius: "8px",
                background: isActive
                  ? "linear-gradient(135deg, #f43f5e, #e11d48)"
                  : "linear-gradient(135deg, #10b981, #059669)",
                border: "none",
                color: "#ffffff",
                fontSize: "0.88rem",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: isActive
                  ? "0 4px 15px rgba(244, 63, 94, 0.4)"
                  : "0 4px 15px rgba(16, 185, 129, 0.4)",
                transition: "all 0.15s ease",
              }}
            >
              {isActive ? (
                <>
                  <Pause size={15} />
                  Pause Auto-Trigger
                </>
              ) : (
                <>
                  <Play size={15} fill="#ffffff" />
                  Start Auto-Trigger ({intervalSeconds}s)
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
