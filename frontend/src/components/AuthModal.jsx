import React, { useState, useEffect } from "react";
import {
  X,
  Lock,
  Mail,
  User as UserIcon,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Send,
  Zap
} from "lucide-react";
import { api, BACKEND_URL } from "../services/api";

export default function AuthModal({
  isOpen,
  initialTab = "login",
  initialError = null,
  initialSuccess = null,
  onClose,
  onAuthSuccess
}) {
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [successMsg, setSuccessMsg] = useState(initialSuccess);
  const [unverifiedEmail, setUnverifiedEmail] = useState(null);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (initialError !== undefined) {
      setError(initialError);
    }
  }, [initialError]);

  useEffect(() => {
    if (initialSuccess !== undefined) {
      setSuccessMsg(initialSuccess);
    }
  }, [initialSuccess]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (tab === "signup") {
        const res = await api.signup({ name, email, password });

        if (res.data?.accessToken) {
          api.setSession(res.data.accessToken, res.data.refreshToken, res.data.user);
          onAuthSuccess(res.data.user);
          onClose();
          return;
        }

        setUnverifiedEmail(email);
        setSuccessMsg(res.message || "Account created! Please check your email to activate your account.");
        setTab("verifyNotice");
      } else {
        const res = await api.login({ email, password });
        onAuthSuccess(res.data.user);
        onClose();
      }
    } catch (err) {
      if (err.data?.unverified) {
        setUnverifiedEmail(err.data.email || email);
        setError("Your account is not activated. Please verify your email before logging in.");
      } else {
        setError(err.message || "Authentication request failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    setError(null);
    try {
      const res = await api.resendVerification(unverifiedEmail);
      setSuccessMsg(res.message || "A fresh verification link has been sent to your email.");
    } catch (err) {
      setError(err.message || "Could not resend email");
    } finally {
      setResending(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 50,
      background: "rgba(0, 0, 0, 0.75)",
      backdropFilter: "blur(10px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }}>
      <div
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: "460px",
          padding: "36px",
          position: "relative",
          animation: "floatLoop 0s ease"
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "rgba(255, 255, 255, 0.05)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "50%",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            cursor: "pointer"
          }}
        >
          <X size={16} />
        </button>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{
            width: "48px",
            height: "48px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "14px",
            boxShadow: "0 0 25px var(--primary-glow)"
          }}>
            <Zap size={24} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "6px" }}>
            {tab === "login" && "Welcome to NexFlow"}
            {tab === "signup" && "Create Developer Account"}
            {tab === "verifyNotice" && "Verify Your Email"}
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}>
            {tab === "login" && "Authenticate to access your DAG workflow engine"}
            {tab === "signup" && "Join Dormammu Loop with cryptographic session protection"}
            {tab === "verifyNotice" && "Check your inbox for your single-use verification link"}
          </p>
        </div>

        {tab !== "verifyNotice" && (
          <div style={{
            display: "flex",
            background: "rgba(0, 0, 0, 0.3)",
            padding: "4px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
            marginBottom: "24px"
          }}>
            <button
              type="button"
              onClick={() => { setTab("login"); setError(null); }}
              style={{
                flex: 1,
                padding: "8px 0",
                fontSize: "0.875rem",
                fontWeight: "600",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: tab === "login" ? "var(--primary)" : "transparent",
                color: tab === "login" ? "#ffffff" : "var(--text-secondary)",
                transition: "all 0.2s"
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setTab("signup"); setError(null); }}
              style={{
                flex: 1,
                padding: "8px 0",
                fontSize: "0.875rem",
                fontWeight: "600",
                borderRadius: "6px",
                border: "none",
                cursor: "pointer",
                background: tab === "signup" ? "var(--primary)" : "transparent",
                color: tab === "signup" ? "#ffffff" : "var(--text-secondary)",
                transition: "all 0.2s"
              }}
            >
              Create Account
            </button>
          </div>
        )}

        {error && (
          <div style={{
            padding: "12px 14px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(244, 63, 94, 0.12)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            color: "#fb7185",
            fontSize: "0.85rem",
            marginBottom: "20px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px"
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div>{error}</div>
              {unverifiedEmail && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ffffff",
                    textDecoration: "underline",
                    cursor: "pointer",
                    fontSize: "0.825rem",
                    marginTop: "6px",
                    fontWeight: "600"
                  }}
                >
                  {resending ? "Sending..." : "Resend Verification Link"}
                </button>
              )}
            </div>
          </div>
        )}

        {successMsg && (
          <div style={{
            padding: "12px 14px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#34d399",
            fontSize: "0.85rem",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
            <div>{successMsg}</div>
          </div>
        )}

        {tab === "verifyNotice" ? (
          <div>
            <div style={{
              background: "rgba(11, 14, 24, 0.8)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "24px",
              marginBottom: "24px",
              textAlign: "center"
            }}>
              <div style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(99, 102, 241, 0.15)",
                border: "1px solid rgba(99, 102, 241, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
                color: "var(--accent-cyan)"
              }}>
                <Mail size={28} />
              </div>

              <h3 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "8px", color: "#f1f5f9" }}>
                Verify your email address
              </h3>

              <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.5" }}>
                We sent an activation link to:
              </p>

              <div style={{
                fontSize: "0.95rem",
                fontWeight: "700",
                color: "var(--accent-cyan)",
                background: "rgba(15, 23, 42, 0.6)",
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid var(--border-subtle)",
                wordBreak: "break-all",
                marginBottom: "16px"
              }}>
                {unverifiedEmail}
              </div>

              <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: "1.6", margin: 0 }}>
                Please check your inbox and click the <strong>Activate Account &amp; Verify Email</strong> button in the email to activate your account.
              </p>
            </div>

            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="btn btn-secondary"
                style={{ flex: 1, fontSize: "0.85rem", padding: "10px 14px", justifyContent: "center" }}
              >
                <Send size={15} /> {resending ? "Sending..." : "Resend Email"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("login");
                  setError(null);
                  setSuccessMsg(null);
                }}
                className="btn btn-primary"
                style={{ flex: 1, fontSize: "0.85rem", padding: "10px 14px", justifyContent: "center" }}
              >
                Go to Sign In
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {tab === "signup" && (
              <div className="input-group">
                <label className="input-label">Full Name</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    required
                    className="input-control"
                    placeholder="e.g. Tony Stark"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    style={{ paddingLeft: "38px" }}
                  />
                  <UserIcon size={16} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
                </div>
              </div>
            )}

            <div className="input-group">
              <label className="input-label">Email Address</label>
              <div style={{ position: "relative" }}>
                <input
                  type="email"
                  required
                  className="input-control"
                  placeholder="developer@dormammu.io"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ paddingLeft: "38px" }}
                />
                <Mail size={16} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">
                Password {tab === "signup" && <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>(min. 8 characters)</span>}
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="input-control"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingLeft: "38px", paddingRight: "40px" }}
                />
                <Lock size={16} style={{ position: "absolute", left: "14px", top: "15px", color: "var(--text-muted)" }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "14px",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer"
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: "100%", marginTop: "10px", padding: "12px" }}
            >
              {loading ? (
                <span>Processing...</span>
              ) : (
                <span>{tab === "login" ? "Sign In to Engine" : "Create Account"}</span>
              )}
            </button>

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              margin: "24px 0"
            }}>
              <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "var(--border-subtle)" }} />
            </div>

            <a
              href={`${BACKEND_URL}/api/auth/google`}
              className="btn btn-secondary"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                textDecoration: "none"
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.9c2.28-2.1 3.64-5.2 3.64-9.15z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.9-3.05c-1.08.72-2.45 1.16-4.03 1.16-3.1 0-5.74-2.1-6.68-4.93H1.26v3.15C3.26 21.36 7.34 24 12 24z" />
                <path fill="#FBBC05" d="M5.32 14.27c-.24-.73-.38-1.5-.38-2.27s.14-1.54.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.06-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.26 6.58l4.06 3.15c.94-2.83 3.58-4.98 6.68-4.98z" />
              </svg>
              <span>Continue with Google</span>
            </a>
          </form>
        )}
      </div>
    </div>
  );
}
