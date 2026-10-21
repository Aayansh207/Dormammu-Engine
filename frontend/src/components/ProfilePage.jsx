import React, { useState, useEffect, useRef } from "react";
import { 
  User as UserIcon, 
  Mail, 
  ShieldCheck, 
  ShieldAlert, 
  Laptop, 
  Smartphone, 
  Globe, 
  Clock, 
  Trash2, 
  LogOut, 
  KeyRound, 
  Save, 
  AlertCircle, 
  CheckCircle2,
  RefreshCw,
  Monitor,
  Tablet,
  Radio,
  Upload,
  Camera,
  History,
  X
} from "lucide-react";
import { api } from "../services/api";

export default function ProfilePage({ user, onUserUpdated, onLogout }) {
  const [profile, setProfile] = useState(user);
  const [name, setName] = useState(user?.name || "");
  const [photo, setPhoto] = useState(user?.profilePhoto || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileErr, setProfileErr] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionErr, setSessionErr] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    loadSessions();
    loadFreshProfile();
    loadHistory();
  }, []);

  const loadFreshProfile = async () => {
    try {
      const res = await api.getProfile();
      setProfile(res.data);
      setName(res.data.name || "");
      setPhoto(res.data.profilePhoto || "");
      onUserUpdated(res.data);
    } catch (e) {
    }
  };

  const loadSessions = async () => {
    setLoadingSessions(true);
    setSessionErr(null);
    try {
      const res = await api.getSessions();
      setSessions(res.data || []);
    } catch (err) {
      setSessionErr(err.message || "Failed to load active sessions");
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.getLoginHistory(1, 10);
      setHistory(res.data || []);
    } catch (e) {
    } finally {
      setLoadingHistory(false);
    }
  };

  const processImageFile = (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileErr("Please upload an image file (PNG, JPG, WebP, etc.)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileErr("Image size should be under 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        setPhoto(dataUrl);
        setProfileErr(null);
        setProfileMsg("Image loaded. Click 'Save Profile' to apply changes.");
      };
      img.onerror = () => {
        setProfileErr("Could not process selected image");
      };
      img.src = event.target.result;
    };
    reader.onerror = () => {
      setProfileErr("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemovePhoto = () => {
    setPhoto("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setProfileMsg("Photo removed. Click 'Save Profile' to apply changes.");
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    setProfileErr(null);

    try {
      const res = await api.updateProfile({ name, profilePhoto: photo });
      setProfile(res.data);
      onUserUpdated(res.data);
      setProfileMsg("Profile updated successfully!");
    } catch (err) {
      setProfileErr(err.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRevokeSession = async (id) => {
    setRevokingId(id);
    try {
      await api.revokeSession(id);
      setSessions(sessions.filter((s) => s.id !== id));
    } catch (err) {
      setSessionErr(err.message || "Could not revoke session");
    } finally {
      setRevokingId(null);
    }
  };

  const handleLogoutAll = async () => {
    if (!window.confirm("Are you sure you want to log out of all active devices?")) return;
    setLoggingOutAll(true);
    try {
      await api.logoutAll();
      onLogout();
    } catch (err) {
      setSessionErr(err.message || "Failed to revoke all sessions");
      setLoggingOutAll(false);
    }
  };

  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "Just now";
    const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
    const seconds = Math.floor(diff / 1000);
    if (seconds < 45) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes === 1) return "1 min ago";
    if (minutes < 60) return `${minutes} mins ago`;
    const hours = Math.floor(minutes / 60);
    if (hours === 1) return "1 hr ago";
    if (hours < 24) return `${hours} hrs ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

  const parseSessionDevice = (sess) => {
    const ua = sess.userAgent || "";
    const ip = sess.ipAddress || "";

    let browser = sess.browser || "";
    let version = sess.browserVersion || "";

    if (!browser || browser === "Web Browser" || browser === "Unknown Browser") {
      if (/Edg\/([\d.]+)/i.test(ua)) {
        browser = "Microsoft Edge";
        version = RegExp.$1.split(".")[0];
      } else if (/OPR\/([\d.]+)/i.test(ua) || /Opera\/([\d.]+)/i.test(ua)) {
        browser = "Opera";
        version = RegExp.$1.split(".")[0];
      } else if (/Chrome\/([\d.]+)/i.test(ua)) {
        browser = "Google Chrome";
        version = RegExp.$1.split(".")[0];
      } else if (/Firefox\/([\d.]+)/i.test(ua)) {
        browser = "Mozilla Firefox";
        version = RegExp.$1.split(".")[0];
      } else if (/Version\/([\d.]+).*Safari/i.test(ua)) {
        browser = "Apple Safari";
        version = RegExp.$1.split(".")[0];
      } else if (/PostmanRuntime\/([\d.]+)/i.test(ua)) {
        browser = "Postman";
        version = RegExp.$1.split(".")[0];
      } else if (/curl\/([\d.]+)/i.test(ua)) {
        browser = "cURL CLI";
      } else {
        browser = "Desktop Browser";
      }
    }

    let os = sess.os || "";
    if (!os || os === "Unknown OS") {
      if (/Windows NT 10\.0/i.test(ua)) {
        os = "Windows 10/11";
      } else if (/Windows NT 6\.3/i.test(ua)) {
        os = "Windows 8.1";
      } else if (/Windows/i.test(ua)) {
        os = "Windows";
      } else if (/iPhone/i.test(ua)) {
        os = "iOS (iPhone)";
      } else if (/iPad/i.test(ua)) {
        os = "iPadOS (iPad)";
      } else if (/Android/i.test(ua)) {
        os = "Android";
      } else if (/Macintosh|Mac OS X/i.test(ua)) {
        os = "macOS";
      } else if (/Linux/i.test(ua)) {
        os = "Linux";
      } else {
        os = "Desktop OS";
      }
    }

    let icon = <Laptop size={18} />;
    let deviceCategory = sess.deviceType || "Desktop";

    if (/iPhone|Mobile/i.test(ua) && !/iPad/i.test(ua)) {
      icon = <Smartphone size={18} />;
      deviceCategory = "Mobile";
    } else if (/iPad|Tablet/i.test(ua)) {
      icon = <Tablet size={18} />;
      deviceCategory = "Tablet";
    } else if (/Windows|Macintosh|Linux/i.test(ua)) {
      icon = <Monitor size={18} />;
      deviceCategory = "Desktop";
    }

    let cleanIp = (ip || "127.0.0.1").replace(/^::ffff:/, "").trim();
    if (cleanIp === "::1" || cleanIp === "127.0.0.1") {
      cleanIp = "127.0.0.1 (Localhost)";
    }

    let browserColor = "#3b82f6";
    let browserBg = "rgba(59, 130, 246, 0.15)";
    let browserBorder = "rgba(59, 130, 246, 0.35)";

    if (browser.includes("Firefox")) {
      browserColor = "#fb923c";
      browserBg = "rgba(249, 115, 22, 0.15)";
      browserBorder = "rgba(249, 115, 22, 0.35)";
    } else if (browser.includes("Edge")) {
      browserColor = "#38bdf8";
      browserBg = "rgba(56, 189, 248, 0.15)";
      browserBorder = "rgba(56, 189, 248, 0.35)";
    } else if (browser.includes("Safari")) {
      browserColor = "#60a5fa";
      browserBg = "rgba(96, 165, 250, 0.15)";
      browserBorder = "rgba(96, 165, 250, 0.35)";
    } else if (browser.includes("Chrome")) {
      browserColor = "#a78bfa";
      browserBg = "rgba(167, 139, 250, 0.15)";
      browserBorder = "rgba(167, 139, 250, 0.35)";
    }

    return {
      browser,
      version,
      browserLabel: version ? `${browser} ${version}` : browser,
      os,
      icon,
      deviceCategory,
      cleanIp,
      browserColor,
      browserBg,
      browserBorder,
    };
  };

  return (
    <div style={{
      maxWidth: "1100px",
      margin: "40px auto 100px auto",
      padding: "0 24px"
    }}>
      <div className="glass-panel" style={{
        padding: "36px",
        marginBottom: "32px",
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "24px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {photo || profile?.profilePhoto ? (
            <img 
              src={photo || profile.profilePhoto} 
              alt={profile?.name || profile?.email}
              style={{
                width: "80px",
                height: "80px",
                borderRadius: "50%",
                objectFit: "cover",
                border: "2px solid var(--primary)",
                boxShadow: "0 0 25px var(--primary-glow)"
              }}
            />
          ) : (
            <div style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed 0%, #06b6d4 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
              fontWeight: "700",
              color: "#fff",
              boxShadow: "0 0 25px var(--primary-glow)"
            }}>
              {(profile?.name || profile?.email || "U")[0].toUpperCase()}
            </div>
          )}

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
              <h2 style={{ fontSize: "1.6rem" }}>{profile?.name || "Anonymous Engineer"}</h2>
              <span style={{
                fontSize: "0.75rem",
                fontWeight: "700",
                padding: "2px 8px",
                borderRadius: "4px",
                background: "rgba(124, 58, 237, 0.2)",
                color: "#a78bfa",
                border: "1px solid rgba(124, 58, 237, 0.4)"
              }}>
                {profile?.role || "USER"}
              </span>
            </div>
            
            <div style={{ color: "var(--text-secondary)", fontSize: "0.95rem", display: "flex", alignItems: "center", gap: "8px" }}>
              <Mail size={15} color="var(--text-muted)" />
              <span>{profile?.email}</span>
              {profile?.emailVerified ? (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "var(--accent-emerald)",
                  fontSize: "0.8rem",
                  fontWeight: "600"
                }}>
                  <ShieldCheck size={14} /> Verified
                </span>
              ) : (
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "var(--accent-amber)",
                  fontSize: "0.8rem",
                  fontWeight: "600"
                }}>
                  <ShieldAlert size={14} /> Unverified
                </span>
              )}
            </div>

            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "8px" }}>
              Member since {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "2026"} // Active on Dormammu Cloud
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button 
            onClick={onLogout} 
            className="btn btn-secondary"
            style={{ fontSize: "0.875rem" }}
          >
            <LogOut size={16} /> Sign Out
          </button>
          <button 
            onClick={handleLogoutAll} 
            disabled={loggingOutAll}
            className="btn btn-danger"
            style={{ fontSize: "0.875rem" }}
          >
            <Trash2 size={16} /> {loggingOutAll ? "Revoking..." : "Logout All Devices"}
          </button>
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
        gap: "32px"
      }}>
        <div className="glass-panel" style={{ padding: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <KeyRound size={20} color="var(--primary-light)" />
            <h3 style={{ fontSize: "1.2rem" }}>Profile Information</h3>
          </div>

          {profileMsg && (
            <div style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(16, 185, 129, 0.12)",
              color: "#34d399",
              fontSize: "0.85rem",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <CheckCircle2 size={16} /> {profileMsg}
            </div>
          )}

          {profileErr && (
            <div style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(244, 63, 94, 0.12)",
              color: "#fb7185",
              fontSize: "0.85rem",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <AlertCircle size={16} /> {profileErr}
            </div>
          )}

          <form onSubmit={handleUpdateProfile}>
            <div className="input-group">
              <label className="input-label">Profile Photo</label>
              
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={{ display: "none" }}
              />

              <div 
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: isDragging ? "2px dashed var(--primary)" : "1px dashed var(--border-subtle)",
                  borderRadius: "var(--radius-md)",
                  padding: "18px",
                  background: isDragging ? "rgba(124, 58, 237, 0.15)" : "rgba(11, 14, 24, 0.6)",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                <div style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255, 255, 255, 0.05)",
                  flexShrink: 0
                }}>
                  {photo ? (
                    <img 
                      src={photo} 
                      alt="Preview" 
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                    />
                  ) : (
                    <Camera size={22} color="var(--primary-light)" />
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: "600", color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Upload size={15} color="var(--accent-cyan)" />
                    <span>Upload New Photo</span>
                  </div>
                  <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    Click or drag & drop an image (PNG, JPG, WebP)
                  </div>
                </div>

                {photo && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePhoto();
                    }}
                    className="btn btn-secondary"
                    style={{ padding: "6px 10px", fontSize: "0.75rem", color: "#fb7185" }}
                    title="Remove Photo"
                  >
                    <X size={14} /> Remove
                  </button>
                )}
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Display Name</label>
              <input 
                type="text" 
                className="input-control"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Email Address (Read-only)</label>
              <input 
                type="text" 
                disabled 
                className="input-control"
                value={profile?.email || ""}
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>

            <div style={{
              padding: "12px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--border-subtle)",
              marginBottom: "20px",
              fontSize: "0.825rem",
              color: "var(--text-secondary)"
            }}>
              <div style={{ fontWeight: "600", marginBottom: "4px" }}>Linked Identity Methods:</div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "6px" }}>
                {profile?.hasPassword && (
                  <span className="glass-pill" style={{ padding: "4px 10px", fontSize: "0.75rem", color: "#e2e8f0" }}>
                    ✔ Native Password
                  </span>
                )}
                {profile?.linkedProviders?.includes("google") && (
                  <span className="glass-pill" style={{ padding: "4px 10px", fontSize: "0.75rem", color: "#60a5fa" }}>
                    ✔ Google OAuth
                  </span>
                )}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={savingProfile}
              className="btn btn-primary"
              style={{ width: "100%" }}
            >
              <Save size={16} /> {savingProfile ? "Saving Changes..." : "Save Profile"}
            </button>
          </form>
        </div>

        <div className="glass-panel" style={{ padding: "32px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Laptop size={20} color="var(--accent-cyan)" />
              <h3 style={{ fontSize: "1.2rem" }}>Active Sessions</h3>
            </div>
            <button 
              onClick={loadSessions} 
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
              title="Refresh sessions"
            >
              <RefreshCw size={13} className={loadingSessions ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
            These are devices currently authenticated into your account. You can revoke any unrecognized session.
          </p>

          {sessionErr && (
            <div style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              background: "rgba(244, 63, 94, 0.12)",
              color: "#fb7185",
              fontSize: "0.85rem",
              marginBottom: "16px"
            }}>
              {sessionErr}
            </div>
          )}

          {loadingSessions ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 10px auto" }} />
              <div>Fetching active sessions...</div>
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              No active sessions found.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {sessions.map((sess) => {
                const dev = parseSessionDevice(sess);
                return (
                  <div 
                    key={sess.id}
                    style={{
                      padding: "16px 18px",
                      borderRadius: "var(--radius-md)",
                      background: sess.isCurrent ? "rgba(124, 58, 237, 0.08)" : "rgba(11, 14, 24, 0.8)",
                      border: "1px solid " + (sess.isCurrent ? "var(--primary-glow)" : "var(--border-subtle)"),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "16px",
                      transition: "all 0.2s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1 }}>
                      <div style={{
                        width: "42px",
                        height: "42px",
                        borderRadius: "10px",
                        background: sess.isCurrent ? "linear-gradient(135deg, #7c3aed, #4f46e5)" : "rgba(255, 255, 255, 0.05)",
                        border: "1px solid " + (sess.isCurrent ? "var(--primary)" : "var(--border-subtle)"),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        boxShadow: sess.isCurrent ? "0 0 15px var(--primary-glow)" : "none",
                        flexShrink: 0
                      }}>
                        {dev.icon}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "5px", flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{
                            fontSize: "0.85rem",
                            fontWeight: "700",
                            color: dev.browserColor,
                            background: dev.browserBg,
                            border: `1px solid ${dev.browserBorder}`,
                            padding: "2px 8px",
                            borderRadius: "6px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px"
                          }}>
                            {dev.browserLabel}
                          </span>

                          <span style={{
                            fontSize: "0.8rem",
                            fontWeight: "600",
                            color: "var(--text-primary)",
                            background: "rgba(255, 255, 255, 0.06)",
                            border: "1px solid var(--border-subtle)",
                            padding: "2px 8px",
                            borderRadius: "6px"
                          }}>
                            {dev.os}
                          </span>

                          {sess.isCurrent && (
                            <span style={{
                              fontSize: "0.7rem",
                              padding: "2px 8px",
                              borderRadius: "var(--radius-full)",
                              background: "rgba(16, 185, 129, 0.2)",
                              color: "#34d399",
                              border: "1px solid rgba(16, 185, 129, 0.4)",
                              fontWeight: "700",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px"
                            }}>
                              <span style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: "#10b981",
                                boxShadow: "0 0 6px #10b981"
                              }} />
                              THIS DEVICE (ACTIVE)
                            </span>
                          )}
                        </div>

                        <div style={{
                          fontSize: "0.78rem",
                          color: "var(--text-secondary)",
                          display: "flex",
                          alignItems: "center",
                          gap: "14px",
                          flexWrap: "wrap"
                        }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Globe size={13} color="var(--accent-cyan)" />
                            <strong style={{ color: "var(--text-primary)" }}>IP:</strong> {dev.cleanIp}
                          </span>

                          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <Clock size={13} color="var(--text-muted)" />
                            <span>Active: {formatRelativeTime(sess.lastUsedAt)}</span>
                          </span>

                          <span style={{ color: "var(--text-muted)" }}>
                            Signed in: {new Date(sess.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {!sess.isCurrent ? (
                      <button
                        onClick={() => handleRevokeSession(sess.id)}
                        disabled={revokingId === sess.id}
                        className="btn btn-danger"
                        style={{ padding: "6px 12px", fontSize: "0.78rem", flexShrink: 0 }}
                        title="Revoke this device session"
                      >
                        <Trash2 size={13} />
                        {revokingId === sess.id ? "Revoking..." : "Revoke"}
                      </button>
                    ) : (
                      <div style={{
                        fontSize: "0.75rem",
                        color: "var(--accent-emerald)",
                        fontWeight: "600",
                        padding: "4px 8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px"
                      }}>
                        <ShieldCheck size={14} /> Current
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Login & Security History Card */}
        <div className="glass-panel" style={{ padding: "32px", marginTop: "24px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <History size={20} color="var(--primary)" />
              <h3 style={{ fontSize: "1.2rem" }}>Recent Login History</h3>
            </div>
            <button 
              onClick={loadHistory} 
              className="btn btn-secondary"
              style={{ padding: "6px 12px", fontSize: "0.8rem" }}
              title="Refresh login history"
            >
              <RefreshCw size={13} className={loadingHistory ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "20px" }}>
            Audit log of recent authentication activity and security events on your account.
          </p>

          {loadingHistory ? (
            <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>
              <RefreshCw size={22} className="animate-spin" style={{ margin: "0 auto 10px auto" }} />
              <div>Fetching login history...</div>
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)", fontSize: "0.88rem" }}>
              No login history recorded yet.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {history.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: "14px 16px",
                    borderRadius: "var(--radius-md)",
                    background: item.status === "SUCCESS" ? "rgba(16, 185, 129, 0.04)" : "rgba(244, 63, 94, 0.04)",
                    border: `1px solid ${item.status === "SUCCESS" ? "rgba(16, 185, 129, 0.18)" : "rgba(244, 63, 94, 0.25)"}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: item.status === "SUCCESS" ? "rgba(16, 185, 129, 0.15)" : "rgba(244, 63, 94, 0.15)",
                      color: item.status === "SUCCESS" ? "#34d399" : "#fb7185",
                    }}>
                      {item.status === "SUCCESS" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{
                          fontSize: "0.82rem",
                          fontWeight: "700",
                          color: item.status === "SUCCESS" ? "#34d399" : "#fb7185",
                        }}>
                          {item.status === "SUCCESS" ? "Login Succeeded" : "Login Failed"}
                        </span>
                        <span className="glass-pill" style={{ fontSize: "0.72rem", padding: "1px 7px" }}>
                          {item.method === "GOOGLE" ? "Google OAuth" : "Email & Password"}
                        </span>
                        {item.reason && (
                          <span style={{ fontSize: "0.75rem", color: "#fb7185" }}>
                            ({item.reason})
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
                        {item.device || "Unknown Device"} • IP: {item.ipAddress}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {new Date(item.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
