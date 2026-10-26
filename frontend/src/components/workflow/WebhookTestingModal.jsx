import React, { useState } from "react";
import { 
  X, 
  Send, 
  Copy, 
  Check, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ExternalLink, 
  Zap, 
  Lock, 
  RotateCcw,
  Code2
} from "lucide-react";
import { api } from "../../services/api";

export default function WebhookTestingModal({
  isOpen,
  onClose,
  workflowId,
  workflowName,
  onOpenRun,
  onOpenReport,
}) {
  if (!isOpen) return null;

  const [jsonBody, setJsonBody] = useState(JSON.stringify({ event: "webhook.test", timestamp: new Date().toISOString() }, null, 2));
  const [secretToken, setSecretToken] = useState("");
  const [isAsync, setIsAsync] = useState(false);
  const [jsonError, setJsonError] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [responseState, setResponseState] = useState(null); // { status, ok, data }
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);

  const webhookUrl = api.getWebhookUrl(workflowId, isAsync);

  const handleJsonChange = (e) => {
    const val = e.target.value;
    setJsonBody(val);
    try {
      JSON.parse(val);
      setJsonError(null);
    } catch (err) {
      setJsonError(err.message);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyResponse = () => {
    if (!responseState?.data) return;
    navigator.clipboard.writeText(JSON.stringify(responseState.data, null, 2));
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  const handleSendTestEvent = async () => {
    let parsedBody;
    try {
      parsedBody = JSON.parse(jsonBody);
    } catch (err) {
      setJsonError("Invalid JSON: " + err.message);
      return;
    }

    setIsSending(true);
    setResponseState(null);

    try {
      const res = await api.sendWebhook(workflowId, parsedBody, secretToken.trim() || null, isAsync);
      setResponseState(res);
    } catch (err) {
      setResponseState({
        status: err.status || 500,
        ok: false,
        data: { error: { message: err.message } },
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(12px)",
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
          maxWidth: "800px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid rgba(57, 174, 169, 0.3)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.95)",
          borderRadius: "14px",
          background: "var(--bg-card)",
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
            background: "linear-gradient(90deg, rgba(57, 174, 169, 0.12) 0%, transparent 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #39AEA9, #557B83)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 15px rgba(57, 174, 169, 0.4)",
              }}
            >
              <Zap size={18} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h3 style={{ fontSize: "1.05rem", fontWeight: "700", color: "var(--text-primary)" }}>
                  Webhook Testing Panel
                </h3>
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "2px 8px",
                    borderRadius: "10px",
                    background: "rgba(57, 174, 169, 0.15)",
                    border: "1px solid var(--brand-border)",
                    color: "var(--brand)",
                    fontWeight: "600",
                  }}
                >
                  Live Ingestion
                </span>
              </div>
              <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                Dispatch authenticated HTTP events directly to the engine
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
              borderRadius: "6px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "18px" }}>
          
          {/* Endpoint URL & Auth Details */}
          <div
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "10px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
              <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                POST Endpoint URL
              </span>
              <button
                type="button"
                onClick={handleCopyUrl}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  color: copiedUrl ? "#10b981" : "var(--brand)",
                  cursor: "pointer",
                  fontSize: "0.72rem",
                  fontWeight: "600",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                {copiedUrl ? <Check size={12} /> : <Copy size={12} />}
                {copiedUrl ? "Copied URL" : "Copy URL"}
              </button>
            </div>

            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.82rem",
                color: "var(--text-primary)",
                background: "var(--bg-input)",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border-subtle)",
                wordBreak: "break-all",
              }}
            >
              {webhookUrl}
            </div>

            {/* Token Input */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontSize: "0.76rem" }}>
                <Lock size={13} color="var(--brand)" />
                <span>Auth Token (Header <code>x-webhook-token</code>):</span>
              </div>
              <input
                type="text"
                value={secretToken}
                onChange={(e) => setSecretToken(e.target.value)}
                placeholder="Optional webhook token..."
                style={{
                  flex: 1,
                  maxWidth: "260px",
                  padding: "5px 10px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "6px",
                  color: "var(--text-primary)",
                  fontSize: "0.78rem",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
              />
              <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                (Protected by token verification)
              </span>
            </div>

            {/* Execution Mode Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: "600" }}>
                Execution Mode:
              </span>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.76rem", color: !isAsync ? "var(--brand)" : "var(--text-secondary)", cursor: "pointer", fontWeight: !isAsync ? "700" : "500" }}>
                <input
                  type="radio"
                  name="execMode"
                  checked={!isAsync}
                  onChange={() => setIsAsync(false)}
                />
                Synchronous (Wait for DAG result)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.76rem", color: isAsync ? "var(--brand)" : "var(--text-secondary)", cursor: "pointer", fontWeight: isAsync ? "700" : "500" }}>
                <input
                  type="radio"
                  name="execMode"
                  checked={isAsync}
                  onChange={() => setIsAsync(true)}
                />
                Asynchronous (Immediate HTTP 202 Ack)
              </label>
            </div>
          </div>


          {/* JSON Payload Editor */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Code2 size={14} color="var(--brand)" />
                <span style={{ fontSize: "0.8rem", fontWeight: "700", color: "var(--text-primary)" }}>
                  JSON Request Body
                </span>
              </div>
              {jsonError ? (
                <span style={{ fontSize: "0.72rem", color: "#f43f5e", display: "flex", alignItems: "center", gap: "4px" }}>
                  <AlertCircle size={12} /> {jsonError}
                </span>
              ) : (
                <span style={{ fontSize: "0.72rem", color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Check size={12} /> Valid JSON Syntax
                </span>
              )}
            </div>

            <textarea
              rows={8}
              value={jsonBody}
              onChange={handleJsonChange}
              style={{
                width: "100%",
                padding: "12px",
                background: "var(--bg-input)",
                border: `1px solid ${jsonError ? "#f43f5e" : "var(--border-subtle)"}`,
                borderRadius: "8px",
                color: "var(--text-primary)",
                fontSize: "0.82rem",
                fontFamily: "var(--font-mono)",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {/* Action Button */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "4px" }}>
            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
              Executes through the sequential DAG engine and records full PostgreSQL state.
            </div>

            <button
              type="button"
              onClick={handleSendTestEvent}
              disabled={isSending || Boolean(jsonError)}
              style={{
                padding: "10px 22px",
                background: isSending || jsonError ? "var(--bg-secondary)" : "linear-gradient(135deg, #39AEA9, #479994)",
                color: isSending || jsonError ? "var(--text-muted)" : "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontWeight: "700",
                fontSize: "0.88rem",
                cursor: isSending || jsonError ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: isSending || jsonError ? "none" : "0 4px 15px rgba(57, 174, 169, 0.35)",
              }}
            >
              {isSending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Dispatching Webhook...
                </>
              ) : (
                <>
                  <Send size={15} />
                  Send Test Event
                </>
              )}
            </button>
          </div>

          {/* Response Inspector */}
          {responseState && (
            <div
              style={{
                border: `1px solid ${responseState.ok ? "rgba(16, 185, 129, 0.4)" : "rgba(244, 63, 94, 0.4)"}`,
                borderRadius: "10px",
                background: responseState.ok ? "rgba(16, 185, 129, 0.05)" : "rgba(244, 63, 94, 0.05)",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {responseState.ok ? (
                    <CheckCircle2 size={18} color="#10b981" />
                  ) : (
                    <XCircle size={18} color="#f43f5e" />
                  )}
                  <span style={{ fontSize: "0.86rem", fontWeight: "700", color: responseState.ok ? "#10b981" : "#f43f5e" }}>
                    HTTP {responseState.status} {responseState.ok ? (isAsync ? "Accepted (Running)" : "Success") : "Error"}
                  </span>
                  {responseState.data?.status && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        fontWeight: "700",
                        background: responseState.data.status === "SUCCEEDED" ? "rgba(16, 185, 129, 0.15)" : "rgba(57, 174, 169, 0.15)",
                        color: responseState.data.status === "SUCCEEDED" ? "#10b981" : "var(--brand)",
                      }}
                    >
                      {responseState.data.status}
                    </span>
                  )}
                  {responseState.data?.durationMs !== undefined && (
                    <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      ({responseState.data.durationMs}ms engine latency)
                    </span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleCopyResponse}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "6px",
                      padding: "3px 8px",
                      color: copiedResponse ? "#10b981" : "var(--text-muted)",
                      cursor: "pointer",
                      fontSize: "0.72rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {copiedResponse ? <Check size={12} /> : <Copy size={12} />}
                    {copiedResponse ? "Copied" : "Copy Response"}
                  </button>

                  {responseState.data?.runId && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (onOpenReport) {
                          onOpenReport(responseState.data.runId);
                        } else {
                          window.location.href = `/runs/${responseState.data.runId}`;
                        }
                      }}
                      style={{
                        background: "linear-gradient(135deg, #39AEA9, #479994)",
                        border: "none",
                        borderRadius: "6px",
                        padding: "6px 14px",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontSize: "0.78rem",
                        fontWeight: "700",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 2px 8px rgba(57, 174, 169, 0.35)",
                      }}
                    >
                      <ExternalLink size={13} />
                      View Full Execution Report
                    </button>
                  )}
                </div>
              </div>

              {/* Complete Report URL Bar */}
              {(responseState.data?.viewReportUrl || responseState.data?.reportPageUrl || responseState.data?.reportUrl) && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "rgba(0, 0, 0, 0.25)",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "0.75rem",
                    flexWrap: "wrap",
                    gap: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", overflow: "hidden" }}>
                    <span style={{ color: "var(--text-muted)", fontWeight: "600" }}>Report URL:</span>
                    <a
                      href={responseState.data.viewReportUrl || responseState.data.reportPageUrl || responseState.data.reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "var(--brand)",
                        textDecoration: "underline",
                        fontFamily: "var(--font-mono)",
                        wordBreak: "break-all",
                      }}
                    >
                      {responseState.data.viewReportUrl || responseState.data.reportPageUrl || responseState.data.reportUrl}
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const urlToCopy = responseState.data.viewReportUrl || responseState.data.reportPageUrl || responseState.data.reportUrl;
                      navigator.clipboard.writeText(urlToCopy);
                      setCopiedUrl(true);
                      setTimeout(() => setCopiedUrl(false), 2000);
                    }}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: copiedUrl ? "#10b981" : "var(--brand)",
                      cursor: "pointer",
                      fontSize: "0.72rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: 0,
                    }}
                  >
                    {copiedUrl ? <Check size={11} /> : <Copy size={11} />}
                    {copiedUrl ? "Copied" : "Copy Link"}
                  </button>
                </div>
              )}

              {/* Final Output Panel */}
              {responseState.data?.finalOutput !== undefined && responseState.data?.finalOutput !== null && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.74rem", fontWeight: "700", color: "#10b981", textTransform: "uppercase" }}>
                      Final Workflow Output
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(responseState.data.finalOutput, null, 2));
                        setCopiedResponse(true);
                        setTimeout(() => setCopiedResponse(false), 2000);
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: copiedResponse ? "#10b981" : "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: "0.7rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <Copy size={11} /> Copy Output
                    </button>
                  </div>
                  <pre
                    style={{
                      background: "var(--bg-input)",
                      padding: "10px 12px",
                      borderRadius: "6px",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      fontSize: "0.78rem",
                      fontFamily: "var(--font-mono)",
                      color: "var(--text-primary)",
                      maxHeight: "180px",
                      overflowY: "auto",
                      margin: 0,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {JSON.stringify(responseState.data.finalOutput, null, 2)}
                  </pre>
                </div>
              )}

              {/* Formatted Response Body */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "0.7rem", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>
                  Full HTTP Response Payload
                </span>
                <pre
                  style={{
                    background: "var(--bg-input)",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-mono)",
                    color: "var(--text-primary)",
                    maxHeight: "150px",
                    overflowY: "auto",
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {JSON.stringify(responseState.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
