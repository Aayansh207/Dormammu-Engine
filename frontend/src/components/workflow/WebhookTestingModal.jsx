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
          </div>
        </div>
      </div>
    </div>
  );
}
