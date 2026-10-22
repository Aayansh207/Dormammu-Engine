import React, { useState, useEffect } from "react";
import { 
  Zap, 
  User as UserIcon, 
  LogOut, 
  ShieldCheck, 
  Layers, 
  Menu, 
  X,
  Home,
  Activity,
  ChevronRight
} from "lucide-react";

export default function Navbar({ 
  user, 
  activeView, 
  setActiveView, 
  onOpenAuth, 
  onLogout,
  backendHealth 
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
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
    <header className="sticky top-0 z-40 w-full" style={{
      background: "rgba(7, 9, 14, 0.85)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
      borderBottom: "1px solid var(--border-subtle)",
      position: "sticky",
      top: 0
    }}>
      <div style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px"
      }}>
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
          <div style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 18px var(--primary-glow)",
            flexShrink: 0
          }}>
            <Zap size={20} color="#ffffff" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }} />
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ 
                fontSize: "1.15rem", 
                fontWeight: "800", 
                fontFamily: "var(--font-display)", 
                letterSpacing: "-0.02em" 
              }}>
                NexFlow
              </span>

              {/* Status dot + Badge (Badge hidden on very small mobile) */}
              <span className="navbar-badge" style={{
                fontSize: "0.68rem",
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
                <span className="navbar-badge-text">DORMAMMU</span>
              </span>
            </div>

            <div className="navbar-subtitle" style={{ 
              fontSize: "0.7rem", 
              color: "var(--text-muted)", 
              letterSpacing: "0.04em", 
              textTransform: "uppercase" 
            }}>
              DAG Workflow Engine
            </div>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="desktop-nav" style={{
          display: "none",
          alignItems: "center",
          gap: "20px"
        }}>
          <button 
            onClick={() => handleNavClick("home")}
            style={{
              background: "none",
              border: "none",
              color: activeView === "home" ? "var(--primary-light)" : "var(--text-secondary)",
              fontWeight: activeView === "home" ? "600" : "500",
              fontSize: "0.9rem",
              cursor: "pointer",
              transition: "color 0.2s ease",
              padding: "6px 8px"
            }}
          >
            Engine Home
          </button>

          {user && (
            <button 
              onClick={() => handleNavClick("profile")}
              style={{
                background: "none",
                border: "none",
                color: activeView === "profile" ? "var(--primary-light)" : "var(--text-secondary)",
                fontWeight: activeView === "profile" ? "600" : "500",
                fontSize: "0.9rem",
                cursor: "pointer",
                transition: "color 0.2s ease",
                padding: "6px 8px"
              }}
            >
              Account &amp; Sessions
            </button>
          )}
        </nav>

        {/* Desktop Actions */}
        <div className="desktop-actions" style={{ display: "none", alignItems: "center", gap: "10px" }}>
          {user ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div 
                onClick={() => handleNavClick("profile")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "5px 12px 5px 6px",
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
                    style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover" }} 
                  />
                ) : (
                  <div style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #6366f1, #a855f7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "700",
                    fontSize: "0.8rem",
                    color: "#fff"
                  }}>
                    {(user.name || user.email)[0].toUpperCase()}
                  </div>
                )}
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "0.82rem", fontWeight: "600", lineHeight: "1.2" }}>
                    {user.name || user.email.split("@")[0]}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    {user.emailVerified ? (
                      <span style={{ fontSize: "0.65rem", color: "var(--accent-emerald)", display: "flex", alignItems: "center", gap: "2px" }}>
                        <ShieldCheck size={10} /> Verified
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.65rem", color: "var(--accent-amber)" }}>
                        Unverified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <button 
                onClick={handleLogoutAction} 
                className="btn btn-secondary"
                title="Log out"
                style={{ padding: "8px 12px", minHeight: "38px" }}
              >
                <LogOut size={15} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button 
                onClick={() => handleAuthAction("login")} 
                className="btn btn-secondary"
                style={{ padding: "8px 16px", minHeight: "38px", fontSize: "0.88rem" }}
              >
                Sign In
              </button>
              <button 
                onClick={() => handleAuthAction("signup")} 
                className="btn btn-primary"
                style={{ padding: "8px 18px", minHeight: "38px", fontSize: "0.88rem" }}
              >
                Get Started
              </button>
            </div>
          )}
        </div>

        {/* Mobile Header Controls */}
        <div className="mobile-controls" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {user ? (
            <button
              onClick={() => handleNavClick("profile")}
              style={{
                background: activeView === "profile" ? "rgba(124, 58, 237, 0.25)" : "rgba(255, 255, 255, 0.08)",
                border: "1px solid " + (activeView === "profile" ? "var(--primary)" : "var(--border-subtle)"),
                borderRadius: "50%",
                padding: "2px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "36px",
                height: "36px"
              }}
              title="View Profile"
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
                  fontSize: "0.8rem",
                  color: "#fff"
                }}>
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
              )}
            </button>
          ) : (
            <button 
              onClick={() => handleAuthAction("login")} 
              className="btn btn-secondary"
              style={{ padding: "6px 12px", minHeight: "36px", fontSize: "0.82rem" }}
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
              padding: "8px", 
              minHeight: "36px", 
              width: "36px",
              justifyContent: "center"
            }}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown / Drawer */}
      {mobileMenuOpen && (
        <div 
          className="animate-menu"
          style={{
            background: "rgba(11, 14, 24, 0.98)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderBottom: "1px solid var(--border-subtle)",
            padding: "16px 20px 24px",
            boxShadow: "0 20px 30px rgba(0, 0, 0, 0.7)"
          }}
        >
          {user ? (
            <>
              {/* User summary card inside mobile drawer */}
              <div 
                onClick={() => handleNavClick("profile")}
                style={{
                  background: "rgba(255, 255, 255, 0.04)",
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
                {user.profilePhoto ? (
                  <img 
                    src={user.profilePhoto} 
                    alt={user.name || user.email} 
                    style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover" }} 
                  />
                ) : (
                  <div style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: "700",
                    fontSize: "1.1rem",
                    color: "#fff"
                  }}>
                    {(user.name || user.email)[0].toUpperCase()}
                  </div>
                )}
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
                    padding: "12px 14px",
                    background: activeView === "home" ? "rgba(124, 58, 237, 0.15)" : "transparent",
                    border: "1px solid " + (activeView === "home" ? "var(--primary-glow)" : "transparent"),
                    borderRadius: "var(--radius-sm)",
                    color: activeView === "home" ? "var(--primary-light)" : "var(--text-primary)",
                    fontWeight: activeView === "home" ? "600" : "500",
                    fontSize: "0.92rem",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <Home size={18} />
                  <span>Engine Home</span>
                </button>

                <button
                  onClick={() => handleNavClick("profile")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    width: "100%",
                    padding: "12px 14px",
                    background: activeView === "profile" ? "rgba(124, 58, 237, 0.15)" : "transparent",
                    border: "1px solid " + (activeView === "profile" ? "var(--primary-glow)" : "transparent"),
                    borderRadius: "var(--radius-sm)",
                    color: activeView === "profile" ? "var(--primary-light)" : "var(--text-primary)",
                    fontWeight: activeView === "profile" ? "600" : "500",
                    fontSize: "0.92rem",
                    cursor: "pointer",
                    textAlign: "left"
                  }}
                >
                  <UserIcon size={18} />
                  <span>Account &amp; Active Sessions</span>
                </button>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogoutAction}
                className="btn btn-danger"
                style={{ width: "100%", justifyContent: "center", padding: "11px" }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{
                padding: "8px 0 12px 0",
                fontSize: "0.82rem",
                color: "var(--text-secondary)",
                borderBottom: "1px solid var(--border-subtle)",
                marginBottom: "6px"
              }}>
                Welcome to NexFlow Dormammu Loop. Sign in to access your DAG orchestrator.
              </div>

              <button
                onClick={() => handleAuthAction("login")}
                className="btn btn-secondary"
                style={{ width: "100%", justifyContent: "center", padding: "12px" }}
              >
                Sign In
              </button>

              <button
                onClick={() => handleAuthAction("signup")}
                className="btn btn-primary"
                style={{ width: "100%", justifyContent: "center", padding: "12px" }}
              >
                Get Started
              </button>
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
                background: backendHealth ? "#10b981" : "#f59e0b"
              }} />
              DAG Engine {backendHealth ? "Online" : "Connecting"}
            </span>
            <span>v2.0 • Zero-Trust</span>
          </div>
        </div>
      )}

      {/* Responsive media query adjustments */}
      <style>{`
        @media (min-width: 768px) {
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
          .navbar-subtitle {
            display: none !important;
          }
        }
        @media (max-width: 360px) {
          .navbar-badge-text {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
}
