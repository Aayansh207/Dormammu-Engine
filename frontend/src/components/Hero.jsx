import React from "react";
import { Workflow, ArrowRight, Play, Sparkles, Shield, GitBranch } from "lucide-react";

export default function Hero({ user, onOpenAuth, onNavigateProfile }) {
  return (
    <section 
      style={{
        minHeight: "calc(100vh - 75px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 24px",
        position: "relative",
      }}
    >
      <div 
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "6px 16px",
          borderRadius: "20px",
          background: "rgba(124, 58, 237, 0.12)",
          border: "1px solid rgba(124, 58, 237, 0.3)",
          color: "var(--primary-light)",
          fontSize: "0.82rem",
          fontWeight: "600",
          marginBottom: "24px",
        }}
      >
        <Sparkles size={14} />
        <span>Webster DAG Workflow Automation Engine</span>
      </div>

      <h1 
        style={{
          fontSize: "clamp(2.5rem, 7vw, 5.5rem)",
          fontWeight: "800",
          letterSpacing: "-0.035em",
          lineHeight: "1.08",
          fontFamily: "var(--font-display)",
          maxWidth: "900px",
          marginBottom: "20px",
        }}
      >
        Automate workflows with <span className="gradient-accent">Deterministic DAGs</span>
      </h1>

      <p 
        style={{
          fontSize: "clamp(1rem, 2vw, 1.2rem)",
          color: "var(--text-secondary)",
          maxWidth: "620px",
          lineHeight: "1.6",
          marginBottom: "36px",
        }}
      >
        Connect mathematical nodes, transform JSON streams, validate contracts against an authoritative catalogue, and execute sequentially with complete audit traces.
      </p>

      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "center" }}>
        {user ? (
          <button
            onClick={onNavigateProfile}
            style={{
              padding: "14px 28px",
              background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
              border: "none",
              borderRadius: "12px",
              color: "#ffffff",
              fontSize: "1rem",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              boxShadow: "0 0 30px rgba(124, 58, 237, 0.5)",
              transition: "transform 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0px)")}
          >
            <Workflow size={20} />
            Launch Workflow Builder
            <ArrowRight size={18} />
          </button>
        ) : (
          <>
            <button
              onClick={() => onOpenAuth("register")}
              style={{
                padding: "14px 28px",
                background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
                border: "none",
                borderRadius: "12px",
                color: "#ffffff",
                fontSize: "1rem",
                fontWeight: "700",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                boxShadow: "0 0 30px rgba(124, 58, 237, 0.5)",
              }}
            >
              Get Started Free
              <ArrowRight size={18} />
            </button>
            <button
              onClick={() => onOpenAuth("login")}
              style={{
                padding: "14px 24px",
                background: "rgba(255, 255, 255, 0.05)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "12px",
                color: "var(--text-primary)",
                fontSize: "1rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Sign In
            </button>
          </>
        )}
      </div>

      {/* Features */}
      <div 
        style={{
          display: "flex",
          gap: "28px",
          marginTop: "60px",
          color: "var(--text-muted)",
          fontSize: "0.85rem",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <GitBranch size={16} color="var(--primary-light)" /> Directed Acyclic Graphs
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Shield size={16} color="var(--accent-cyan)" /> 4-Level Schema Validation
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Play size={16} color="var(--accent-emerald)" /> Immutable Versioned Runs
        </span>
      </div>
    </section>
  );
}
