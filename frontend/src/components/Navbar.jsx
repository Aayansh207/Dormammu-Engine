import React, { useState, useEffect } from "react";
import { 
  Workflow, 
  User as UserIcon, 
  LogOut, 
  ShieldCheck, 
  Layers, 
  Menu, 
  X,
  Home,
  Sun,
  Moon,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

function NavAvatar({ user, size = 26, fontSize = "0.76rem" }) {
  const [hasError, setHasError] = useState(false);
  const initial = (user?.name || user?.email || "U")[0].toUpperCase();
  const photoUrl = user?.profilePhoto && !user.profilePhoto.startsWith("blob:") ? user.profilePhoto : null;

  if (photoUrl && !hasError) {
    return (
      <img
        src={photoUrl}
        alt={user.name || user.email}
        onError={() => setHasError(true)}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "linear-gradient(135deg, #ff5d44, #ff8c42)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: "700",
        fontSize: fontSize,
        color: "#fff",
        flexShrink: 0
      }}
    >
      {initial}
    </div>
  );
}

export default function Navbar({ 
  user, 
  activeView, 
  setActiveView, 
  onOpenAuth, 
  onLogout,
  backendHealth 
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 900) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleNavClick = (view) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  const handleAuthAction = (tab) => {
    setMobileMenuOpen(false);
    onOpenAuth(tab);
  };

  const handleLogoutAction = () => {
    setMobileMenuOpen(false);
    onLogout();
  };

  return (
    <header 
      className="sticky top-0 z-50 w-full"
      style={{
        padding: "12px 16px",
        transition: "all 0.2s ease"
      }}
    >
      <div 
        style={{
          maxWidth: "1240px",
          margin: "0 auto",
          background: "var(--nav-bg)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid var(--nav-border)",
          borderRadius: "var(--radius-full)",
          padding: "8px 16px 8px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "var(--shadow-sm)",
          transition: "background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease"
        }}
      >
        {/* Brand / Logo */}
        <div 
          onClick={() => handleNavClick("home")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            cursor: "pointer",
            userSelect: "none",
            flexShrink: 0
          }}
        >
          {/* n8n-inspired geometric node loop icon */}
          <div 
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #ff5d44 0%, #ff8c42 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 14px var(--brand-glow)",
              flexShrink: 0,
              transition: "transform 0.2s ease"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path 
                d="M4 12C4 8.68629 6.68629 6 10 6C13.3137 6 16 8.68629 16 12C16 15.3137 13.3137 18 10 18C6.68629 18 4 15.3137 4 12Z" 
                stroke="#ffffff" 
                strokeWidth="2.5"
              />
              <path 
                d="M14 12C14 8.68629 16.6863 6 20 6" 
                stroke="#ffffff" 
                strokeWidth="2.5" 
                strokeLinecap="round"
              />
              <circle cx="20" cy="12" r="2" fill="#ffffff" />
            </svg>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span 
              style={{ 
                fontSize: "1.24rem", 
                fontWeight: "800", 
                fontFamily: "var(--font-display)", 
                letterSpacing: "-0.03em",
                color: "var(--text-primary)"
              }}
            >
              NexFlow
            </span>

            {/* DAG Engine Badge */}
            <span 
              className="navbar-badge" 
              style={{
                fontSize: "0.68rem",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "var(--radius-full)",
                background: "var(--brand-light)",
                color: "var(--brand)",
                border: "1px solid var(--brand-border)",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                letterSpacing: "0.02em"
              }}
            >
              <span 
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: backendHealth ? "var(--accent-emerald)" : "var(--accent-amber)",
                  display: "inline-block",
                  boxShadow: backendHealth ? "0 0 6px var(--accent-emerald)" : "none"
                }} 
              />
              <span className="navbar-badge-text">DAG Engine</span>
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav 
          className="desktop-nav" 
          style={{
            display: "none",
            alignItems: "center",
            gap: "4px"
          }}
        >
          <button 
            onClick={() => handleNavClick("home")}
            style={{
              background: activeView === "home" ? "var(--bg-chip)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-full)",
              color: activeView === "home" ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: activeView === "home" ? "600" : "500",
              fontSize: "0.88rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
              padding: "7px 14px"
            }}
            onMouseEnter={(e) => {
              if (activeView !== "home") e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              if (activeView !== "home") e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            Product
          </button>

          <button 
            onClick={() => handleNavClick("workflows")}
            style={{
              background: activeView === "workflows" ? "var(--bg-chip)" : "transparent",
              border: "none",
              borderRadius: "var(--radius-full)",
              color: activeView === "workflows" ? "var(--text-primary)" : "var(--text-secondary)",
              fontWeight: activeView === "workflows" ? "600" : "500",
              fontSize: "0.88rem",
              cursor: "pointer",
              transition: "all 0.15s ease",
              padding: "7px 14px"
            }}
            onMouseEnter={(e) => {
              if (activeView !== "workflows") e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              if (activeView !== "workflows") e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            Workflows
          </button>

          <a 
            href="#architecture"
            style={{
              color: "var(--text-secondary)",
              fontWeight: "500",
              fontSize: "0.88rem",
              textDecoration: "none",
              padding: "7px 14px",
              borderRadius: "var(--radius-full)",
              transition: "color 0.15s ease"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            Architecture
          </a>

          {user && (
            <button 
              onClick={() => handleNavClick("profile")}
              style={{
                background: activeView === "profile" ? "var(--bg-chip)" : "transparent",
                border: "none",
                borderRadius: "var(--radius-full)",
                color: activeView === "profile" ? "var(--text-primary)" : "var(--text-secondary)",
                fontWeight: activeView === "profile" ? "600" : "500",
                fontSize: "0.88rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
                padding: "7px 14px"
              }}
              onMouseEnter={(e) => {
                if (activeView !== "profile") e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                if (activeView !== "profile") e.currentTarget.style.color = "var(--text-secondary)";
              }}
            >
              Account
            </button>
          )}
        </nav>

        {/* Desktop Actions */}
        <div className="desktop-actions" style={{ display: "none", alignItems: "center", gap: "10px" }}>
          {/* Light / Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="btn btn-ghost"
            style={{
              width: "36px",
              height: "36px",
              padding: 0,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-card)",
              cursor: "pointer"
            }}
            title={theme === "light" ? "Switch to Dark theme" : "Switch to Light theme"}
            aria-label="Toggle Theme"
          >
            {theme === "light" ? (
              <Moon size={17} style={{ transition: "transform 0.3s ease" }} />
            ) : (
              <Sun size={17} color="#fbbf24" style={{ transition: "transform 0.3s ease" }} />
            )}
          </button>

          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div 
                onClick={() => handleNavClick("profile")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  padding: "4px 12px 4px 5px",
                  borderRadius: "var(--radius-full)",
                  background: activeView === "profile" ? "var(--brand-light)" : "var(--bg-chip)",
                  border: "1px solid " + (activeView === "profile" ? "var(--brand-border)" : "var(--border-subtle)"),
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                <NavAvatar user={user} size={26} fontSize="0.76rem" />
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: "600", lineHeight: "1.2", color: "var(--text-primary)" }}>
                    {user.name || user.email.split("@")[0]}
                  </div>
                </div>
              </div>

              <button 
                onClick={() => handleNavClick("workflows")}
                className="btn btn-primary"
                style={{ padding: "7px 16px", fontSize: "0.85rem", height: "36px" }}
              >
                <Workflow size={15} />
                Builder
              </button>

              <button 
                onClick={handleLogoutAction} 
                className="btn btn-ghost"
                title="Log out"
                style={{
                  width: "36px",
                  height: "36px",
                  padding: 0,
                  borderRadius: "50%",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-muted)"
                }}
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button 
                onClick={() => handleAuthAction("login")} 
                className="btn btn-ghost"
                style={{ padding: "7px 16px", fontSize: "0.88rem", height: "36px" }}
              >
                Sign in
              </button>
              <button 
                onClick={() => handleAuthAction("signup")} 
                className="btn btn-primary"
                style={{ padding: "7px 18px", fontSize: "0.88rem", height: "36px" }}
              >
                Get started
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Mobile Header Controls */}
        <div className="mobile-controls" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Light / Dark Mode Toggle on Mobile */}
          <button
            onClick={toggleTheme}
            className="btn btn-ghost"
            style={{
              width: "34px",
              height: "34px",
              padding: 0,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-card)",
              color: "var(--text-secondary)"
            }}
            title="Toggle theme"
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} color="#fbbf24" />}
          </button>

          {user ? (
            <button
              onClick={() => handleNavClick("profile")}
              style={{
                background: "var(--bg-chip)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "50%",
                padding: "2px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "34px",
                height: "34px"
              }}
              title="View Profile"
            >
              <NavAvatar user={user} size={28} fontSize="0.75rem" />
            </button>
          ) : (
            <button 
              onClick={() => handleAuthAction("login")} 
              className="btn btn-secondary"
              style={{ padding: "6px 12px", minHeight: "34px", fontSize: "0.82rem" }}
            >
              Sign In
            </button>
          )}

          {/* Hamburger Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="btn btn-secondary"
            aria-label="Toggle Navigation Menu"
            style={{ 
              padding: "7px", 
              minHeight: "34px", 
              width: "34px",
              justifyContent: "center"
            }}
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown / Drawer */}
      {mobileMenuOpen && (
        <div 
          className="animate-menu"
          style={{
            maxWidth: "1240px",
            margin: "10px auto 0",
            background: "var(--bg-card)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "18px 20px 22px",
            boxShadow: "var(--shadow-xl)"
          }}
        >
          {user ? (
            <>
              {/* User summary card inside mobile drawer */}
              <div 
                onClick={() => handleNavClick("profile")}
                style={{
                  background: "var(--bg-chip)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "16px",
                  cursor: "pointer"
                }}
              >
                <NavAvatar user={user} size={42} fontSize="1.05rem" />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div style={{ fontWeight: "700", fontSize: "0.95rem", color: "var(--text-primary)" }}>
                    {user.name || user.email.split("@")[0]}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {user.email}
                  </div>
                  <div style={{ marginTop: "3px" }}>
                    {user.emailVerified ? (
                      <span style={{ fontSize: "0.68rem", color: "var(--accent-emerald)", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <ShieldCheck size={11} /> Verified Account
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.68rem", color: "var(--accent-amber)" }}>
                        Unverified Email
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight size={18} color="var(--text-muted)" />
              </div>

              {/* Navigation Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                <button
                  onClick={() => handleNavClick("home")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: "11px 14px",
                    background: activeView === "home" ? "var(--brand-light)" : "transparent",
                    border: "1px solid " + (activeView === "home" ? "var(--brand-border)" : "transparent"),
                    borderRadius: "var(--radius-md)",
                    color: activeView === "home" ? "var(--brand)" : "var(--text-primary)",
                    fontWeight: activeView === "home" ? "600" : "500",
                    fontSize: "0.92rem",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <Home size={18} />
                  <span>Product Home</span>
                </button>

                <button
                  onClick={() => handleNavClick("workflows")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: "11px 14px",
                    background: activeView === "workflows" || activeView === "workflow-editor" ? "var(--brand-light)" : "transparent",
                    border: "1px solid " + (activeView === "workflows" || activeView === "workflow-editor" ? "var(--brand-border)" : "transparent"),
                    borderRadius: "var(--radius-md)",
                    color: activeView === "workflows" || activeView === "workflow-editor" ? "var(--brand)" : "var(--text-primary)",
                    fontWeight: activeView === "workflows" || activeView === "workflow-editor" ? "600" : "500",
                    fontSize: "0.92rem",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <Layers size={18} />
                  <span>Workflows &amp; Canvas</span>
                </button>

                <button
                  onClick={() => handleNavClick("profile")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: "11px 14px",
                    background: activeView === "profile" ? "var(--brand-light)" : "transparent",
                    border: "1px solid " + (activeView === "profile" ? "var(--brand-border)" : "transparent"),
                    borderRadius: "var(--radius-md)",
                    color: activeView === "profile" ? "var(--brand)" : "var(--text-primary)",
                    fontWeight: activeView === "profile" ? "600" : "500",
                    fontSize: "0.92rem",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <UserIcon size={18} />
                  <span>Account &amp; API Keys</span>
                </button>
              </div>

              {/* Theme toggle row */}
              <div 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between", 
                  padding: "10px 14px", 
                  background: "var(--bg-chip)", 
                  borderRadius: "var(--radius-md)", 
                  marginBottom: "14px" 
                }}
              >
                <span style={{ fontSize: "0.86rem", fontWeight: "600", color: "var(--text-secondary)" }}>
                  Theme ({theme === "light" ? "Light" : "Dark"})
                </span>
                <button
                  onClick={toggleTheme}
                  className="btn btn-secondary"
                  style={{ padding: "6px 12px", fontSize: "0.8rem", height: "32px" }}
                >
                  {theme === "light" ? <Moon size={14} /> : <Sun size={14} color="#fbbf24" />}
                  Switch to {theme === "light" ? "Dark" : "Light"}
                </button>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogoutAction}
                className="btn btn-danger"
                style={{ width: "100%", justifyContent: "center", padding: "10px" }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{
                padding: "4px 0 12px 0",
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                borderBottom: "1px solid var(--border-subtle)",
                marginBottom: "4px"
              }}>
                Build and execute event-driven DAG pipelines with NexFlow.
              </div>

              <button
                onClick={() => handleAuthAction("login")}
                className="btn btn-secondary"
                style={{ width: "100%", justifyContent: "center", padding: "11px" }}
              >
                Sign In
              </button>

              <button
                onClick={() => handleAuthAction("signup")}
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "11px" }}
              >
                Get Started Free
                <ArrowRight size={16} />
              </button>

              <div 
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between", 
                  padding: "10px 12px", 
                  background: "var(--bg-chip)", 
                  borderRadius: "var(--radius-md)", 
                  marginTop: "6px" 
                }}
              >
                <span style={{ fontSize: "0.84rem", fontWeight: "500", color: "var(--text-secondary)" }}>
                  Appearance
                </span>
                <button
                  onClick={toggleTheme}
                  className="btn btn-secondary"
                  style={{ padding: "5px 12px", fontSize: "0.78rem", height: "30px" }}
                >
                  {theme === "light" ? <Moon size={13} /> : <Sun size={13} color="#fbbf24" />}
                  {theme === "light" ? "Dark Mode" : "Light Mode"}
                </button>
              </div>
            </div>
          )}

          {/* Cluster Status Footer in Mobile Menu */}
          <div style={{
            marginTop: "16px",
            paddingTop: "12px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "var(--text-muted)"
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <span style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: backendHealth ? "var(--accent-emerald)" : "var(--accent-amber)"
              }} />
              DAG Engine {backendHealth ? "Online" : "Connecting"}
            </span>
            <span>NexFlow Platform • v2.0</span>
          </div>
        </div>
      )}

      {/* Responsive media query adjustments */}
      <style>{`
        @media (min-width: 900px) {
          .desktop-nav {
            display: flex !important;
          }
          .desktop-actions {
            display: flex !important;
          }
          .mobile-controls {
            display: none !important;
          }
        }
        @media (max-width: 480px) {
          .navbar-badge-text {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
