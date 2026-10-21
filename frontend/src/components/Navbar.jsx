import React from "react";
import { 
  Zap, 
  User as UserIcon, 
  LogOut, 
  ShieldCheck, 
  Layers, 
  Cpu, 
  BookOpen 
} from "lucide-react";

export default function Navbar({ 
  user, 
  activeView, 
  setActiveView, 
  onOpenAuth, 
  onLogout,
  backendHealth 
}) {
  return (
    <header className="sticky top-0 z-40 w-full" style={{
      background: "rgba(7, 9, 14, 0.75)",
      backdropFilter: "blur(16px)",
      borderBottom: "1px solid var(--border-subtle)"
    }}>
      <div style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "16px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div 
          onClick={() => setActiveView("home")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            cursor: "pointer",
            userSelect: "none"
          }}
        >
          <div style={{
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 20px var(--primary-glow)"
          }}>
            <Zap size={22} color="#ffffff" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "1.2rem", fontWeight: "800", fontFamily: "var(--font-display)", letterSpacing: "-0.02em" }}>
                NexFlow
              </span>
              <span style={{
                fontSize: "0.7rem",
                fontWeight: "700",
                padding: "2px 6px",
                borderRadius: "4px",
                background: "rgba(124, 58, 237, 0.2)",
                color: "#a78bfa",
                border: "1px solid rgba(124, 58, 237, 0.3)",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px"
              }}>
                <span style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: backendHealth ? "#10b981" : "#f59e0b",
                  display: "inline-block",
                  boxShadow: backendHealth ? "0 0 6px #10b981" : "none"
                }} />
                DORMAMMU LOOP
              </span>
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
              DAG Workflow Engine
            </div>
          </div>
        </div>

        <nav style={{
          display: "none",
          alignItems: "center",
          gap: "28px"
        }} className="desktop-nav">
          {user && (
            <button 
              onClick={() => setActiveView("profile")}
              style={{
                background: "none",
                border: "none",
                color: activeView === "profile" ? "var(--primary-light)" : "var(--text-secondary)",
                fontWeight: activeView === "profile" ? "600" : "500",
                fontSize: "0.9rem",
                cursor: "pointer",
                transition: "color 0.2s ease"
              }}
            >
              Account & Sessions
            </button>
          )}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div 
                onClick={() => setActiveView("profile")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "6px 14px 6px 8px",
                  borderRadius: "var(--radius-full)",
                  background: activeView === "profile" ? "rgba(124, 58, 237, 0.2)" : "rgba(255, 255, 255, 0.05)",
                  border: "1px solid " + (activeView === "profile" ? "var(--primary)" : "var(--border-subtle)"),
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {user.profilePhoto ? (
                  <img 
                    src={user.profilePhoto} 
                    alt={user.name || user.email} 
                    style={{ width: "30px", height: "30px", borderRadius: "50%", objectFit: "cover" }} 
                  />
                ) : (
                  <div style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #a855f7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "700",
                    fontSize: "0.85rem",
                    color: "#fff"
                  }}>
                    {(user.name || user.email)[0].toUpperCase()}
                  </div>
                )}
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", lineHeight: "1.2" }}>
                    {user.name || user.email.split("@")[0]}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {user.emailVerified ? (
                      <span style={{ fontSize: "0.68rem", color: "var(--accent-emerald)", display: "flex", alignItems: "center", gap: "2px" }}>
                        <ShieldCheck size={11} /> Verified
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.68rem", color: "var(--accent-amber)" }}>
                        Unverified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button 
                onClick={onLogout} 
                className="btn btn-secondary"
                title="Log out"
                style={{ padding: "8px 12px" }}
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button 
                onClick={() => onOpenAuth("login")} 
                className="btn btn-secondary"
              >
                Sign In
              </button>
              <button 
                onClick={() => onOpenAuth("signup")} 
                className="btn btn-primary"
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </div>
      <style>{`
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
        }
      `}</style>
    </header>
  );
}
