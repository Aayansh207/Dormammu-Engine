import React, { useState, useEffect, useRef } from "react";
import { 
  User as UserIcon, 
  ShieldCheck, 
  ShieldAlert, 
  Laptop, 
  Smartphone, 
  Globe, 
  Clock, 
  Trash2, 
  LogOut, 
  Save, 
  AlertCircle, 
  CheckCircle2,
  RefreshCw,
  Monitor,
  Tablet,
  Upload,
  Camera,
  X,
  Search,
  Edit3,
  ArrowDownRight,
  Workflow,
  Sparkles,
  ChevronRight,
  Sun,
  Moon,
  Lock
} from "lucide-react";
import { api } from "../services/api";
import { useTheme } from "../context/ThemeContext";

// --- Origami Hummingbird SVG Component ---
function OrigamiBird({ size = 135 }) {
  return (
    <svg
      width={size}
      height={size * 1.05}
      viewBox="0 0 160 170"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.25))" }}
    >
      <defs>
        <linearGradient id="wingGreen1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A2D5AB" />
          <stop offset="100%" stopColor="#39AEA9" />
        </linearGradient>
        <linearGradient id="wingGreen2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#39AEA9" />
          <stop offset="100%" stopColor="#1B4D3E" />
        </linearGradient>
        <linearGradient id="wingCyan" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5EEAD4" />
          <stop offset="100%" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="bodyJade" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2DD4BF" />
          <stop offset="60%" stopColor="#0F766E" />
          <stop offset="100%" stopColor="#134E4A" />
        </linearGradient>
        <linearGradient id="headPurple" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#047857" />
        </linearGradient>
        <linearGradient id="tailWarm" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F59E0B" />
          <stop offset="50%" stopColor="#10B981" />
          <stop offset="100%" stopColor="#34D399" />
        </linearGradient>
        <linearGradient id="tailWarm2" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>

      {/* Tail Feathers */}
      <polygon points="98,124 108,162 101,138" fill="url(#tailWarm)" opacity="0.95" />
      <polygon points="101,138 114,166 106,134" fill="url(#tailWarm2)" />
      <polygon points="106,134 122,160 112,128" fill="url(#tailWarm)" opacity="0.9" />

      {/* Main Body Facets */}
      <polygon points="82,88 108,126 88,118" fill="url(#bodyJade)" />
      <polygon points="88,118 108,126 102,136" fill="#115E59" />
      <polygon points="82,88 104,78 108,126" fill="#0D9488" />
      <polygon points="104,78 126,88 108,126" fill="url(#headPurple)" opacity="0.85" />

      {/* Head and Beak */}
      <polygon points="126,88 138,82 134,96" fill="url(#headPurple)" />
      <polygon points="138,82 158,84 135,89" fill="#F59E0B" />
      <polygon points="126,88 134,96 116,104" fill="#065F46" />

      {/* Left Wing (Back/Upper Facets) */}
      <polygon points="68,52 82,88 64,84" fill="url(#wingGreen2)" />
      <polygon points="46,38 68,52 48,68" fill="url(#wingGreen1)" />
      <polygon points="48,68 68,52 64,84" fill="#2E8B83" />
      <polygon points="28,26 46,38 32,56" fill="url(#wingCyan)" />
      <polygon points="32,56 46,38 48,68" fill="#14B8A6" />
      <polygon points="14,18 28,26 18,44" fill="#A2D5AB" />
      <polygon points="18,44 28,26 32,56" fill="url(#wingGreen1)" />

      {/* Forward Wing Tip Feather Points */}
      <polygon points="14,18 8,36 18,44" fill="#39AEA9" />
      <polygon points="18,44 12,58 32,56" fill="#0D9488" />
      <polygon points="32,56 22,76 48,68" fill="#115E59" />
      <polygon points="48,68 38,94 64,84" fill="#042F2E" opacity="0.8" />

      {/* Right/Fore Wing Overlay */}
      <polygon points="64,84 82,88 88,64" fill="url(#wingCyan)" />
      <polygon points="88,64 82,88 104,78" fill="#2DD4BF" />
      <polygon points="88,64 104,78 98,52" fill="#5EEAD4" />
      <polygon points="88,64 98,52 76,46" fill="#A2D5AB" />
      <polygon points="76,46 98,52 92,34" fill="#39AEA9" />
    </svg>
  );
}

export default function ProfilePage({ user, onUserUpdated, onLogout, onNavigateView }) {
  const { theme, toggleTheme } = useTheme();
  const [profile, setProfile] = useState(user);
  const [name, setName] = useState(user?.name || "");
  const [photo, setPhoto] = useState(user?.profilePhoto || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);
  const [profileErr, setProfileErr] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const fileInputRef = useRef(null);

  // Active navigation tab in the sidebar: "profile" | "sessions" | "history"
  const [activeTab, setActiveTab] = useState("profile");
  const [searchQuery, setSearchQuery] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Sessions and History state
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sessionErr, setSessionErr] = useState(null);
  const [revokingId, setRevokingId] = useState(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [workflowsCount, setWorkflowsCount] = useState(0);

  useEffect(() => {
    loadSessions();
    loadFreshProfile();
    loadHistory();
    loadWorkflows();
  }, []);

  const loadFreshProfile = async () => {
    try {
      const res = await api.getProfile();
      if (res?.data) {
        setProfile(res.data);
        setName(res.data.name || "");
        const cleanPhoto = res.data.profilePhoto && !res.data.profilePhoto.startsWith("blob:") ? res.data.profilePhoto : "";
        setPhoto(cleanPhoto);
        setAvatarError(false);
        setPreviewError(false);
        if (onUserUpdated) onUserUpdated(res.data);
      }
    } catch {
      // ignore
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
      if (api.getLoginHistory) {
        const res = await api.getLoginHistory(1, 10);
        setHistory(res.data || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadWorkflows = async () => {
    try {
      if (api.listWorkflows) {
        const res = await api.listWorkflows();
        if (res?.data?.length !== undefined) {
          setWorkflowsCount(res.data.length);
        }
      }
    } catch {
      // fallback
    }
  };

  const [selectedFile, setSelectedFile] = useState(null);

  const processImageFile = (file) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setProfileErr("Please upload an image file (PNG, JPG, WebP, etc.)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setProfileErr("Image size should be under 10MB");
      return;
    }

    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setPhoto(previewUrl);
    setProfileErr(null);
    setProfileMsg("Image selected. Click 'Save Profile' to upload to Cloudinary.");
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
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setProfileMsg("Photo removed. Click 'Save Profile' to apply changes.");
  };

  const handleUpdateProfile = async (e) => {
    if (e) e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    setProfileErr(null);

    try {
      let updatedUser = profile;

      if (selectedFile) {
        setProfileMsg("Uploading image to Cloudinary...");
        const uploadRes = await api.uploadAvatar(selectedFile);
        if (uploadRes?.data) {
          updatedUser = uploadRes.data;
          setPhoto(updatedUser.profilePhoto || "");
        }
        setSelectedFile(null);
      }

      const hasNameChanged = name.trim() !== (profile?.name || "").trim();
      const hasPhotoRemoved = photo === "" && profile?.profilePhoto;

      if (hasNameChanged || hasPhotoRemoved) {
        const payload = {};
        if (hasNameChanged) payload.name = name.trim();
        if (hasPhotoRemoved) payload.profilePhoto = null;

        const res = await api.updateProfile(payload);
        if (res?.data) {
          updatedUser = { ...updatedUser, ...res.data };
        }
      }

      setProfile(updatedUser);
      setName(updatedUser.name || "");
      setPhoto(updatedUser.profilePhoto || "");
      setAvatarError(false);
      setPreviewError(false);
      if (onUserUpdated) onUserUpdated(updatedUser);
      setProfileMsg("Profile updated and synced successfully!");
      setTimeout(() => setEditModalOpen(false), 1200);
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
      if (onLogout) onLogout();
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
      } else {
        browser = "Desktop Browser";
      }
    }

    let os = sess.os || "";
    if (!os || os === "Unknown OS") {
      if (/Windows NT 10\.0/i.test(ua)) {
        os = "Windows 10/11";
      } else if (/Windows/i.test(ua)) {
        os = "Windows";
      } else if (/iPhone/i.test(ua)) {
        os = "iOS (iPhone)";
      } else if (/iPad/i.test(ua)) {
        os = "iPadOS";
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

    let browserColor = "#1B4D3E";
    let browserBg = "rgba(27, 77, 62, 0.12)";
    let browserBorder = "rgba(27, 77, 62, 0.28)";

    if (browser.includes("Firefox")) {
      browserColor = "#D97706";
      browserBg = "rgba(217, 119, 6, 0.12)";
      browserBorder = "rgba(217, 119, 6, 0.25)";
    } else if (browser.includes("Edge") || browser.includes("Safari") || browser.includes("Chrome")) {
      browserColor = "#2C5E55";
      browserBg = "rgba(44, 94, 85, 0.14)";
      browserBorder = "rgba(44, 94, 85, 0.3)";
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

  const formatDate = (dateVal) => {
    if (!dateVal) return "Member";
    try {
      const d = new Date(dateVal);
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    } catch {
      return "Member";
    }
  };

  // Nav menu items: Only genuine, functional navigation items
  const navItems = [
    { id: "profile", label: "Profile Overview", icon: UserIcon, badge: null },
    { id: "workflows", label: "My Workflows", icon: Workflow, badge: workflowsCount },
    { id: "sessions", label: "Active Sessions", icon: Laptop, badge: sessions.length || 1 },
    { id: "history", label: "Security & Audit", icon: ShieldCheck, badge: history.length ? `${history.length}` : null },
  ];

  const handleSidebarClick = (id) => {
    if (id === "workflows" && onNavigateView) {
      onNavigateView("workflows");
    } else {
      setActiveTab(id);
    }
  };

  // Filtered sessions / history if search query is provided
  const currentSession = sessions.find((s) => s.isCurrent) || sessions[0];
  const currentDev = currentSession ? parseSessionDevice(currentSession) : null;
  const latestLogin = history[0];

  return (
    <div className="profile-page-wrapper">
      <div className="profile-app-frame">
        
        {/* ========================================================
            LEFT SIDEBAR (CLEAN GREEN THEME - ESSENTIAL NAV ONLY)
            ======================================================== */}
        <aside className="profile-sidebar">
          {/* Brand Header */}
          <div className="sidebar-brand-header">
            <div className="sidebar-brand-logo">
              <span className="brand-logo-text">NEXFLOW</span>
              <span className="brand-logo-sub">ENGINE</span>
            </div>
          </div>

          {/* Sidebar Nav Items */}
          <nav className="sidebar-nav">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSidebarClick(item.id)}
                  className={`sidebar-nav-item ${isActive ? "active" : ""}`}
                >
                  <div className="nav-item-content">
                    <Icon size={18} className="nav-icon" />
                    <span className="nav-label">{item.label}</span>
                  </div>

                  {item.badge !== null && item.badge !== undefined && (
                    <span className={`nav-badge ${isActive ? "badge-active" : ""}`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Origami Bird Illustration */}
          <div className="sidebar-footer-artwork">
            <OrigamiBird size={125} />
          </div>
        </aside>

        {/* ========================================================
            MAIN CONTENT CANVAS
            ======================================================== */}
        <main className="profile-main-canvas">
          
          {/* Top Header Row (Title, Search Bar, Theme Toggle, Sign Out) */}
          <header className="profile-canvas-header">
            <div className="canvas-header-left">
              <h1 className="canvas-page-title">
                {activeTab === "profile" && "Profile Overview"}
                {activeTab === "sessions" && "Active Sessions"}
                {activeTab === "history" && "Security & Audit Log"}
              </h1>
            </div>

            <div className="canvas-header-right">
              {/* Pill Search Input */}
              <div className="canvas-search-pill">
                <input
                  type="text"
                  placeholder="Search sessions, audit log..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-pill-input"
                />
                <div className="search-pill-btn">
                  <Search size={14} color="#ffffff" />
                </div>
              </div>

              {/* Light / Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="header-action-btn"
                title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
              >
                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              </button>

              {/* Logout Icon Button */}
              <button
                onClick={onLogout}
                className="header-action-btn logout-btn"
                title="Sign Out of NexFlow"
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>

          {/* ========================================================
              VIEW 1: PROFILE OVERVIEW (CLEAN & PURPOSEFUL)
              ======================================================== */}
          {activeTab === "profile" && (
            <div className="profile-content-grid">
              
              {/* CARD 1: USER PROFILE & IDENTITY */}
              <section className="profile-rounded-card profile-user-card">
                <div className="user-card-header">
                  <span className="card-badge-label">
                    <Sparkles size={13} />
                    <span>AUTHENTICATED USER</span>
                  </span>

                  <button 
                    onClick={() => setEditModalOpen(true)}
                    className="card-edit-action-btn"
                    title="Edit profile & upload photo"
                  >
                    <Edit3 size={16} />
                    <span>Edit Profile</span>
                  </button>
                </div>

                <div className="user-card-body">
                  {/* Circular Avatar */}
                  <div className="user-avatar-halo" onClick={() => setEditModalOpen(true)}>
                    {(photo || profile?.profilePhoto) && !avatarError ? (
                      <img
                        src={photo || profile.profilePhoto}
                        alt={profile?.name || profile?.email}
                        onError={() => setAvatarError(true)}
                        className="user-avatar-img"
                      />
                    ) : (
                      <div className="user-avatar-fallback">
                        {(profile?.name || profile?.email || "U")[0].toUpperCase()}
                      </div>
                    )}
                    <div className="avatar-hover-hint">
                      <Camera size={20} />
                    </div>
                  </div>

                  {/* Real User Details */}
                  <div className="user-info-text-block">
                    <h2 className="user-full-name">
                      {profile?.name || "Developer"}
                    </h2>

                    <div className="user-meta-list">
                      <div className="user-meta-row">
                        <span className="meta-label">Email Address:</span>
                        <span className="meta-value meta-email">{profile?.email || "No email available"}</span>
                      </div>

                      <div className="user-meta-row">
                        <span className="meta-label">Account Status:</span>
                        <span className="meta-value">
                          {profile?.emailVerified ? (
                            <span className="verified-status-chip">
                              <ShieldCheck size={14} /> Verified Account
                            </span>
                          ) : (
                            <span className="unverified-status-chip">
                              <ShieldAlert size={14} /> Unverified Email
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="user-meta-row">
                        <span className="meta-label">Role &amp; Permissions:</span>
                        <span className="meta-value">
                          <span className="role-pill-chip">{profile?.role || "USER"}</span>
                        </span>
                      </div>

                      <div className="user-meta-row">
                        <span className="meta-label">Member Since:</span>
                        <span className="meta-value">{formatDate(profile?.createdAt)}</span>
                      </div>

                      <div className="user-meta-row">
                        <span className="meta-label">Authentication:</span>
                        <div className="auth-methods-row">
                          {profile?.hasPassword && (
                            <span className="auth-method-chip">✔ Native Password</span>
                          )}
                          {profile?.linkedProviders?.includes("google") && (
                            <span className="auth-method-chip google">✔ Google OAuth</span>
                          )}
                          {!profile?.hasPassword && !profile?.linkedProviders?.length && (
                            <span className="auth-method-chip">Session Token</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* CARD 2: ACCOUNT SECURITY & SESSION SNAPSHOT */}
              <section className="profile-rounded-card security-snapshot-card">
                <div className="snapshot-card-header">
                  <div className="snapshot-title-box">
                    <Lock size={18} color="#163E36" />
                    <h3 className="card-section-heading">Security &amp; Device Status</h3>
                  </div>
                  <span className="security-level-pill">
                    <ShieldCheck size={14} /> Protected
                  </span>
                </div>

                <div className="snapshot-card-body">
                  {/* Current Active Device Info */}
                  <div className="current-device-highlight-box">
                    <div className="highlight-icon-box">
                      {currentDev ? currentDev.icon : <Monitor size={20} />}
                    </div>
                    <div className="highlight-details-col">
                      <div className="highlight-title-line">
                        <span className="highlight-device-name">
                          {currentDev ? `${currentDev.browser} on ${currentDev.os}` : "Current Device"}
                        </span>
                        <span className="active-now-pill">
                          <span className="pulse-green-dot" />
                          ACTIVE NOW
                        </span>
                      </div>
                      <div className="highlight-meta-line">
                        <span><Globe size={12} /> IP: {currentDev ? currentDev.cleanIp : "127.0.0.1"}</span>
                        <span><Clock size={12} /> Last active: {currentSession ? formatRelativeTime(currentSession.lastUsedAt) : "Just now"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary Metric Counters */}
                  <div className="security-metrics-row">
                    <div className="security-metric-tile">
                      <div className="metric-number">{sessions.length || 1}</div>
                      <div className="metric-label">Active Devices</div>
                    </div>
                    <div className="security-metric-tile">
                      <div className="metric-number">{workflowsCount}</div>
                      <div className="metric-label">Saved Workflows</div>
                    </div>
                    <div className="security-metric-tile">
                      <div className="metric-number">{history.length || 0}</div>
                      <div className="metric-label">Audit Events</div>
                    </div>
                  </div>

                  {/* Quick Action Navigation Buttons */}
                  <div className="snapshot-actions-row">
                    <button
                      onClick={() => setActiveTab("sessions")}
                      className="btn-snapshot-action"
                    >
                      <Laptop size={15} />
                      <span>Manage All Sessions</span>
                      <ChevronRight size={14} />
                    </button>
                    <button
                      onClick={() => setActiveTab("history")}
                      className="btn-snapshot-action secondary"
                    >
                      <ShieldCheck size={15} />
                      <span>View Audit Log</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </section>

              {/* CARD 3: STEPPED ACTIVITY & PIPELINES TIMELINE */}
              <section className="profile-rounded-card timeline-activity-card">
                <div className="timeline-card-header">
                  <div>
                    <h3 className="card-section-heading">Recent Engine Activity &amp; Connected Devices</h3>
                    <p className="card-section-sub">Real-time authentication, session status, and DAG execution access.</p>
                  </div>
                  <button 
                    onClick={() => setActiveTab("sessions")}
                    className="view-all-link-btn"
                  >
                    View Devices ({sessions.length}) <ChevronRight size={14} />
                  </button>
                </div>

                <div className="timeline-interactive-container">
                  {/* Vertical Stepped Timeline Line */}
                  <div className="timeline-vertical-track">
                    <div className="timeline-node node-double">
                      <div className="node-outer-ring" />
                      <div className="node-inner-dot" />
                    </div>
                    <div className="timeline-connector-line" />
                    <div className="timeline-node node-filled" />
                    <div className="timeline-connector-line" />
                    <div className="timeline-node node-open" />
                  </div>

                  {/* Stepped Timeline Cards */}
                  <div className="timeline-cards-list">
                    
                    {/* Step 1: Active Device Session */}
                    <div className="pipeline-stepped-item step-session">
                      <div className="pipeline-item-info">
                        <div className="stepped-item-title-row">
                          <Laptop size={16} color="#163E36" />
                          <h4 className="pipeline-item-title">
                            {currentDev ? `${currentDev.browser} on ${currentDev.os}` : "Active Browser Session"}
                          </h4>
                        </div>
                        <p className="pipeline-item-subtitle">
                          Authenticated device session • IP: {currentDev ? currentDev.cleanIp : "127.0.0.1"}
                        </p>
                        <span className="pipeline-item-lessons">
                          Active: {currentSession ? formatRelativeTime(currentSession.lastUsedAt) : "Just now"}
                        </span>
                      </div>

                      <div className="pipeline-item-actions">
                        <span className="pipeline-status-tag status-active">
                          ACTIVE NOW
                        </span>
                        <button
                          onClick={() => setActiveTab("sessions")}
                          className="pipeline-action-circle"
                          title="Manage active devices"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Step 2: Recent Security Login Event */}
                    <div className="pipeline-stepped-item step-security">
                      <div className="pipeline-item-info">
                        <div className="stepped-item-title-row">
                          <ShieldCheck size={16} color="#163E36" />
                          <h4 className="pipeline-item-title">
                            {latestLogin ? `Latest Login: ${latestLogin.status === "SUCCESS" ? "Succeeded" : "Failed"}` : "Authentication Audit Check"}
                          </h4>
                        </div>
                        <p className="pipeline-item-subtitle">
                          {latestLogin ? `Method: ${latestLogin.method} • Device: ${latestLogin.device || "Browser"} • IP: ${latestLogin.ipAddress}` : "Zero security flags detected on this account"}
                        </p>
                        <span className="pipeline-item-lessons">
                          {latestLogin ? new Date(latestLogin.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Audited in real-time"}
                        </span>
                      </div>

                      <div className="pipeline-item-actions">
                        <span className="pipeline-status-tag status-verified">
                          VERIFIED
                        </span>
                        <button
                          onClick={() => setActiveTab("history")}
                          className="pipeline-action-circle"
                          title="View complete login history"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Step 3: Workflows & Automations */}
                    <div className="pipeline-stepped-item step-workflow">
                      <div className="pipeline-item-info">
                        <div className="stepped-item-title-row">
                          <Workflow size={16} color="#163E36" />
                          <h4 className="pipeline-item-title">
                            NexFlow DAG Automation Engine
                          </h4>
                        </div>
                        <p className="pipeline-item-subtitle">
                          {workflowsCount > 0 ? `${workflowsCount} workflows ready with BullMQ priority execution` : "Design your first DAG workflow pipeline"}
                        </p>
                        <span className="pipeline-item-lessons">
                          Topological cycle validation • SSE real-time stream
                        </span>
                      </div>

                      <div className="pipeline-item-actions">
                        <span className="pipeline-status-tag status-ready">
                          {workflowsCount > 0 ? `${workflowsCount} WORKFLOWS` : "READY"}
                        </span>
                        <button
                          onClick={() => {
                            if (onNavigateView) onNavigateView("workflows");
                          }}
                          className="pipeline-action-circle"
                          title="Open Workflow Builder"
                        >
                          <ArrowDownRight size={16} />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>
              </section>

            </div>
          )}

          {/* ========================================================
              VIEW 2: ACTIVE SESSIONS (DEVICE MANAGEMENT)
              ======================================================== */}
          {activeTab === "sessions" && (
            <div className="dedicated-tab-panel">
              <div className="profile-rounded-card session-manager-card">
                <div className="tab-panel-header">
                  <div>
                    <h2 className="tab-panel-title">Active Devices &amp; Sessions</h2>
                    <p className="tab-panel-desc">
                      Manage all devices authenticated into your account. Revoke any unfamiliar session with 1 click.
                    </p>
                  </div>
                  <div className="tab-header-buttons">
                    <button 
                      onClick={loadSessions} 
                      className="btn-refresh-sessions"
                      title="Refresh active sessions"
                    >
                      <RefreshCw size={14} className={loadingSessions ? "animate-spin" : ""} /> Refresh
                    </button>
                    <button
                      onClick={handleLogoutAll}
                      disabled={loggingOutAll}
                      className="btn-logout-all"
                    >
                      <Trash2 size={14} /> {loggingOutAll ? "Revoking..." : "Logout All Devices"}
                    </button>
                  </div>
                </div>

                {sessionErr && (
                  <div className="profile-alert alert-error">
                    <AlertCircle size={16} /> {sessionErr}
                  </div>
                )}

                {loadingSessions ? (
                  <div className="loading-state-block">
                    <RefreshCw size={24} className="animate-spin" />
                    <span>Querying active engine sessions...</span>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="empty-state-block">
                    No active sessions found.
                  </div>
                ) : (
                  <div className="sessions-list-container">
                    {sessions.map((sess) => {
                      const dev = parseSessionDevice(sess);
                      return (
                        <div
                          key={sess.id}
                          className={`session-row-card ${sess.isCurrent ? "current-device" : ""}`}
                        >
                          <div className="session-dev-icon-col">
                            <div className="session-icon-box">
                              {dev.icon}
                            </div>
                          </div>

                          <div className="session-dev-details-col">
                            <div className="session-dev-title-row">
                              <span
                                className="session-browser-tag"
                                style={{
                                  color: dev.browserColor,
                                  background: dev.browserBg,
                                  border: `1px solid ${dev.browserBorder}`
                                }}
                              >
                                {dev.browserLabel}
                              </span>

                              <span className="session-os-tag">
                                {dev.os}
                              </span>

                              {sess.isCurrent && (
                                <span className="this-device-badge">
                                  <span className="pulse-green-dot" />
                                  THIS DEVICE (ACTIVE)
                                </span>
                              )}
                            </div>

                            <div className="session-meta-row">
                              <span className="session-ip">
                                <Globe size={13} /> IP: {dev.cleanIp}
                              </span>
                              <span className="session-time">
                                <Clock size={13} /> Active: {formatRelativeTime(sess.lastUsedAt)}
                              </span>
                              <span className="session-created">
                                Signed in: {new Date(sess.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                          </div>

                          <div className="session-action-col">
                            {!sess.isCurrent ? (
                              <button
                                onClick={() => handleRevokeSession(sess.id)}
                                disabled={revokingId === sess.id}
                                className="btn-revoke-session"
                                title="Revoke this device session"
                              >
                                <Trash2 size={13} />
                                {revokingId === sess.id ? "Revoking..." : "Revoke"}
                              </button>
                            ) : (
                              <div className="active-badge-pill">
                                <ShieldCheck size={14} /> Active
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================
              VIEW 3: SECURITY & AUDIT LOG
              ======================================================== */}
          {activeTab === "history" && (
            <div className="dedicated-tab-panel">
              <div className="profile-rounded-card audit-manager-card">
                <div className="tab-panel-header">
                  <div>
                    <h2 className="tab-panel-title">Authentication &amp; Security History</h2>
                    <p className="tab-panel-desc">
                      Real-time audit log of recent sign-ins, token refreshes, and security events.
                    </p>
                  </div>
                  <button 
                    onClick={loadHistory} 
                    className="btn-refresh-sessions"
                    title="Refresh login history"
                  >
                    <RefreshCw size={14} className={loadingHistory ? "animate-spin" : ""} /> Refresh
                  </button>
                </div>

                {loadingHistory ? (
                  <div className="loading-state-block">
                    <RefreshCw size={24} className="animate-spin" />
                    <span>Loading audit log...</span>
                  </div>
                ) : history.length === 0 ? (
                  <div className="empty-state-block">
                    No security events recorded yet.
                  </div>
                ) : (
                  <div className="history-list-container">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className={`history-event-row ${item.status === "SUCCESS" ? "status-success" : "status-failed"}`}
                      >
                        <div className="history-icon-box">
                          {item.status === "SUCCESS" ? (
                            <CheckCircle2 size={18} color="#10B981" />
                          ) : (
                            <AlertCircle size={18} color="#EF4444" />
                          )}
                        </div>

                        <div className="history-details-box">
                          <div className="history-title-line">
                            <span className="history-status-label">
                              {item.status === "SUCCESS" ? "Login Succeeded" : "Login Failed"}
                            </span>
                            <span className="history-method-tag">
                              {item.method === "GOOGLE" ? "Google OAuth" : "Email & Password"}
                            </span>
                            {item.reason && (
                              <span className="history-reason-text">
                                ({item.reason})
                              </span>
                            )}
                          </div>
                          <div className="history-meta-line">
                            {item.device || "Unknown Device"} • IP: {item.ipAddress}
                          </div>
                        </div>

                        <div className="history-timestamp">
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
          )}

        </main>
      </div>

      {/* ========================================================
          MODAL: EDIT PROFILE & PHOTO (CLOUDINARY MULTIPART)
          ======================================================== */}
      {editModalOpen && (
        <div className="edit-modal-backdrop" onClick={() => setEditModalOpen(false)}>
          <div className="edit-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-row">
              <div className="modal-title-box">
                <Edit3 size={20} color="#163E36" />
                <h3 className="modal-heading">Edit Profile Information</h3>
              </div>
              <button 
                onClick={() => setEditModalOpen(false)}
                className="modal-close-btn"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {profileMsg && (
              <div className="modal-alert alert-success">
                <CheckCircle2 size={16} /> {profileMsg}
              </div>
            )}

            {profileErr && (
              <div className="modal-alert alert-error">
                <AlertCircle size={16} /> {profileErr}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="modal-form-content">
              {/* Profile Photo Uploader */}
              <div className="modal-input-field">
                <label className="modal-field-label">Profile Photo</label>
                
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
                  className={`modal-dropzone ${isDragging ? "dropzone-dragging" : ""}`}
                >
                  <div className="dropzone-avatar-preview">
                    {photo && !previewError ? (
                      <img
                        src={photo}
                        alt="Preview"
                        onError={() => setPreviewError(true)}
                        className="preview-img"
                      />
                    ) : (
                      <Camera size={26} color="#163E36" />
                    )}
                  </div>

                  <div className="dropzone-text-col">
                    <div className="dropzone-main-text">
                      <Upload size={16} color="#163E36" />
                      <span>Upload Avatar</span>
                    </div>
                    <div className="dropzone-sub-text">
                      Drag &amp; drop or click to browse (PNG, JPG up to 10MB)
                    </div>
                  </div>

                  <div className="dropzone-actions-col">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="btn-modal-browse"
                    >
                      Browse
                    </button>
                    {photo && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemovePhoto();
                        }}
                        className="btn-modal-remove"
                        title="Remove photo"
                      >
                        <X size={14} /> Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Display Name Input */}
              <div className="modal-input-field">
                <label className="modal-field-label">Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  className="modal-text-control"
                />
              </div>

              {/* Email (Read-only) */}
              <div className="modal-input-field">
                <label className="modal-field-label">Email Address (Read-only)</label>
                <input
                  type="text"
                  disabled
                  value={profile?.email || ""}
                  className="modal-text-control disabled"
                />
              </div>

              {/* Connected OAuth Providers */}
              <div className="modal-linked-box">
                <span className="linked-title">Linked Identity:</span>
                <div className="linked-chips-row">
                  {profile?.hasPassword && (
                    <span className="linked-chip">✔ Native Password</span>
                  )}
                  {profile?.linkedProviders?.includes("google") && (
                    <span className="linked-chip chip-google">✔ Google OAuth</span>
                  )}
                </div>
              </div>

              {/* Save Button */}
              <div className="modal-actions-footer">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="btn-modal-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="btn-modal-save"
                >
                  <Save size={16} />
                  {savingProfile ? "Saving to Cloudinary..." : "Save Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          EMBEDDED STYLES FOR THE CLEAN GREEN PROFILE THEME
          ======================================================== */}
      <style>{`
        /* Wrapper & Canvas Layout */
        .profile-page-wrapper {
          min-height: calc(100vh - 74px);
          background: #eff5f1;
          padding: 24px 20px 48px 20px;
          display: flex;
          justify-content: center;
          font-family: var(--font-body, -apple-system, sans-serif);
          color: #152224;
        }

        [data-theme="dark"] .profile-page-wrapper {
          background: #0d1718;
          color: #e5f0ec;
        }

        .profile-app-frame {
          width: 100%;
          max-width: 1220px;
          display: flex;
          gap: 24px;
          align-items: stretch;
        }

        /* ----------------------------------------------------
           LEFT SIDEBAR (RICH FOREST GREEN THEME)
           ---------------------------------------------------- */
        .profile-sidebar {
          width: 240px;
          flex-shrink: 0;
          background: linear-gradient(180deg, #163E36 0%, #1A433A 60%, #12332C 100%);
          border-radius: 24px;
          padding: 24px 14px 16px 14px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 16px 36px -8px rgba(18, 51, 44, 0.35);
          position: relative;
          overflow: hidden;
        }

        [data-theme="dark"] .profile-sidebar {
          background: linear-gradient(180deg, #102d27 0%, #14352f 60%, #0b1f1a 100%);
          box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.55);
        }

        .sidebar-brand-header {
          padding: 4px 12px 20px 12px;
        }

        .sidebar-brand-logo {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .brand-logo-text {
          font-size: 1.25rem;
          font-weight: 900;
          letter-spacing: 0.07em;
          color: #ffffff;
          font-family: var(--font-display, 'Outfit', sans-serif);
        }

        .brand-logo-sub {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #A2D5AB;
        }

        .sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }

        .sidebar-nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-radius: 14px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.88rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.22s ease;
          text-align: left;
        }

        .sidebar-nav-item:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          transform: translateX(2px);
        }

        .sidebar-nav-item.active {
          background: #eff5f1;
          color: #163E36;
          font-weight: 700;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
        }

        [data-theme="dark"] .sidebar-nav-item.active {
          background: #142826;
          color: #A2D5AB;
        }

        .nav-item-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .nav-icon {
          flex-shrink: 0;
          opacity: 0.9;
        }

        .sidebar-nav-item.active .nav-icon {
          color: #163E36;
          opacity: 1;
        }

        [data-theme="dark"] .sidebar-nav-item.active .nav-icon {
          color: #A2D5AB;
        }

        .nav-badge {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.16);
          color: #ffffff;
        }

        .nav-badge.badge-active {
          background: #163E36;
          color: #ffffff;
        }

        [data-theme="dark"] .nav-badge.badge-active {
          background: #A2D5AB;
          color: #0b1f1a;
        }

        .sidebar-footer-artwork {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 16px 0 6px 0;
          pointer-events: none;
        }

        /* ----------------------------------------------------
           MAIN CANVAS AREA & HEADER
           ---------------------------------------------------- */
        .profile-main-canvas {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-width: 0;
        }

        .profile-canvas-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 2px 4px;
        }

        .canvas-page-title {
          font-size: 1.55rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: #163E36;
          margin: 0;
          font-family: var(--font-display, 'Outfit', sans-serif);
        }

        [data-theme="dark"] .canvas-page-title {
          color: #e2f2eb;
        }

        .canvas-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .canvas-search-pill {
          display: flex;
          align-items: center;
          background: #ffffff;
          border-radius: 9999px;
          padding: 4px 4px 4px 16px;
          box-shadow: 0 2px 10px rgba(22, 62, 54, 0.05);
          border: 1px solid rgba(85, 123, 131, 0.16);
          width: 240px;
          transition: all 0.2s ease;
        }

        [data-theme="dark"] .canvas-search-pill {
          background: #142325;
          border-color: rgba(162, 213, 171, 0.2);
        }

        .canvas-search-pill:focus-within {
          border-color: #39AEA9;
          box-shadow: 0 0 0 3px rgba(57, 174, 169, 0.2);
          width: 270px;
        }

        .search-pill-input {
          flex: 1;
          border: none;
          background: transparent;
          font-size: 0.84rem;
          color: #152224;
          outline: none;
        }

        [data-theme="dark"] .search-pill-input {
          color: #e5f0ec;
        }

        .search-pill-input::placeholder {
          color: #8da1a4;
        }

        .search-pill-btn {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: none;
          background: #163E36;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .header-action-btn {
          width: 36px;
          height: 36px;
          border-radius: 12px;
          border: 1px solid rgba(85, 123, 131, 0.18);
          background: #ffffff;
          color: #557B83;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        }

        [data-theme="dark"] .header-action-btn {
          background: #142325;
          border-color: rgba(162, 213, 171, 0.2);
          color: #A2D5AB;
        }

        .header-action-btn:hover {
          color: #163E36;
          border-color: #39AEA9;
          transform: translateY(-1px);
        }

        .header-action-btn.logout-btn:hover {
          color: #E11D48;
          border-color: rgba(225, 29, 72, 0.35);
          background: rgba(225, 29, 72, 0.08);
        }

        /* ----------------------------------------------------
           CONTENT GRID: CLEAN 2-COLUMN & FULL-WIDTH CARDS
           ---------------------------------------------------- */
        .profile-content-grid {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 20px;
        }

        .profile-rounded-card {
          background: #ffffff;
          border-radius: 22px;
          border: 1px solid rgba(85, 123, 131, 0.14);
          box-shadow: 0 8px 24px -4px rgba(22, 62, 54, 0.06);
          position: relative;
          overflow: hidden;
        }

        [data-theme="dark"] .profile-rounded-card {
          background: #142325;
          border-color: rgba(85, 123, 131, 0.32);
          box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.35);
        }

        /* ----------------------------------------------------
           CARD 1: USER PROFILE & IDENTITY
           ---------------------------------------------------- */
        .profile-user-card {
          padding: 24px 26px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .user-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .card-badge-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 4px 10px;
          border-radius: 9999px;
          background: rgba(57, 174, 169, 0.14);
          color: #163E36;
        }

        [data-theme="dark"] .card-badge-label {
          background: rgba(162, 213, 171, 0.16);
          color: #A2D5AB;
        }

        .card-edit-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(22, 62, 54, 0.06);
          border: 1px solid rgba(22, 62, 54, 0.14);
          color: #163E36;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          padding: 6px 14px;
          border-radius: 10px;
          transition: all 0.2s ease;
        }

        [data-theme="dark"] .card-edit-action-btn {
          background: rgba(162, 213, 171, 0.1);
          border-color: rgba(162, 213, 171, 0.25);
          color: #A2D5AB;
        }

        .card-edit-action-btn:hover {
          background: #163E36;
          color: #ffffff;
        }

        [data-theme="dark"] .card-edit-action-btn:hover {
          background: #A2D5AB;
          color: #102d27;
        }

        .user-card-body {
          display: flex;
          align-items: flex-start;
          gap: 22px;
        }

        .user-avatar-halo {
          width: 84px;
          height: 84px;
          border-radius: 50%;
          position: relative;
          cursor: pointer;
          flex-shrink: 0;
          box-shadow: 0 6px 18px rgba(57, 174, 169, 0.22);
        }

        .user-avatar-img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          border: 3px solid #39AEA9;
        }

        .user-avatar-fallback {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: linear-gradient(135deg, #163E36 0%, #39AEA9 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          font-weight: 800;
          color: #ffffff;
          border: 3px solid #39AEA9;
        }

        .avatar-hover-hint {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: rgba(22, 62, 54, 0.65);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .user-avatar-halo:hover .avatar-hover-hint {
          opacity: 1;
        }

        .user-info-text-block {
          flex: 1;
          min-width: 0;
        }

        .user-full-name {
          font-size: 1.35rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          color: #163E36;
          margin: 0 0 10px 0;
          font-family: var(--font-display, 'Outfit', sans-serif);
        }

        [data-theme="dark"] .user-full-name {
          color: #e2f2eb;
        }

        .user-meta-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .user-meta-row {
          display: flex;
          align-items: center;
          font-size: 0.84rem;
          gap: 8px;
          flex-wrap: wrap;
        }

        .meta-label {
          color: #8da1a4;
          font-weight: 500;
          min-width: 130px;
        }

        [data-theme="dark"] .meta-label {
          color: #7b9496;
        }

        .meta-value {
          color: #2c4246;
          font-weight: 600;
        }

        [data-theme="dark"] .meta-value {
          color: #cad8d5;
        }

        .meta-email {
          color: #163E36;
          font-family: var(--font-mono, monospace);
        }

        [data-theme="dark"] .meta-email {
          color: #A2D5AB;
        }

        .role-pill-chip {
          display: inline-flex;
          align-items: center;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 9999px;
          background: rgba(57, 174, 169, 0.16);
          color: #163E36;
        }

        [data-theme="dark"] .role-pill-chip {
          background: rgba(162, 213, 171, 0.18);
          color: #A2D5AB;
        }

        .verified-status-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.76rem;
          font-weight: 700;
          color: #10B981;
        }

        .unverified-status-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.76rem;
          font-weight: 700;
          color: #D97706;
        }

        .auth-methods-row {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .auth-method-chip {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 6px;
          background: #f1f6f2;
          color: #163E36;
          border: 1px solid rgba(85, 123, 131, 0.16);
        }

        [data-theme="dark"] .auth-method-chip {
          background: #0f1d1f;
          color: #cad8d5;
        }

        .auth-method-chip.google {
          color: #2563EB;
          border-color: rgba(37, 99, 235, 0.25);
          background: rgba(37, 99, 235, 0.06);
        }

        /* ----------------------------------------------------
           CARD 2: SECURITY & ACTIVE DEVICE SNAPSHOT
           ---------------------------------------------------- */
        .security-snapshot-card {
          padding: 24px 22px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .snapshot-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 14px;
        }

        .snapshot-title-box {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .card-section-heading {
          font-size: 1.05rem;
          font-weight: 800;
          color: #163E36;
          margin: 0;
          font-family: var(--font-display, 'Outfit', sans-serif);
        }

        [data-theme="dark"] .card-section-heading {
          color: #e2f2eb;
        }

        .security-level-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 9999px;
          background: rgba(16, 185, 129, 0.15);
          color: #10B981;
        }

        .snapshot-card-body {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .current-device-highlight-box {
          background: #f1f6f2;
          border: 1px solid rgba(85, 123, 131, 0.16);
          border-radius: 14px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        [data-theme="dark"] .current-device-highlight-box {
          background: #0f1d1f;
          border-color: rgba(85, 123, 131, 0.3);
        }

        .highlight-icon-box {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          background: #163E36;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        [data-theme="dark"] .highlight-icon-box {
          background: #1c3d36;
          color: #A2D5AB;
        }

        .highlight-details-col {
          flex: 1;
          min-width: 0;
        }

        .highlight-title-line {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }

        .highlight-device-name {
          font-size: 0.86rem;
          font-weight: 700;
          color: #163E36;
        }

        [data-theme="dark"] .highlight-device-name {
          color: #e2f2eb;
        }

        .active-now-pill {
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: #10B981;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .pulse-green-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10B981;
          box-shadow: 0 0 6px #10B981;
        }

        .highlight-meta-line {
          font-size: 0.74rem;
          color: #668085;
          display: flex;
          gap: 10px;
          margin-top: 3px;
        }

        .highlight-meta-line span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .security-metrics-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .security-metric-tile {
          background: #f8faf8;
          border: 1px solid rgba(85, 123, 131, 0.12);
          border-radius: 12px;
          padding: 10px;
          text-align: center;
        }

        [data-theme="dark"] .security-metric-tile {
          background: #111e20;
          border-color: rgba(85, 123, 131, 0.25);
        }

        .metric-number {
          font-size: 1.25rem;
          font-weight: 800;
          color: #163E36;
        }

        [data-theme="dark"] .metric-number {
          color: #A2D5AB;
        }

        .metric-label {
          font-size: 0.72rem;
          color: #8da1a4;
          font-weight: 600;
          margin-top: 2px;
        }

        .snapshot-actions-row {
          display: flex;
          gap: 8px;
        }

        .btn-snapshot-action {
          flex: 1;
          padding: 9px 12px;
          border-radius: 10px;
          border: 1px solid rgba(22, 62, 54, 0.18);
          background: #163E36;
          color: #ffffff;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          transition: all 0.2s ease;
        }

        .btn-snapshot-action:hover {
          background: #1B4D3E;
        }

        .btn-snapshot-action.secondary {
          background: transparent;
          color: #163E36;
          border-color: rgba(85, 123, 131, 0.25);
        }

        [data-theme="dark"] .btn-snapshot-action.secondary {
          color: #A2D5AB;
        }

        .btn-snapshot-action.secondary:hover {
          background: rgba(22, 62, 54, 0.08);
        }

        /* ----------------------------------------------------
           CARD 3: STEPPED TIMELINE & ACTIVITY CARD (BOTTOM FULL)
           ---------------------------------------------------- */
        .timeline-activity-card {
          grid-column: 1 / -1;
          padding: 24px 26px;
        }

        .timeline-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
        }

        .card-section-sub {
          font-size: 0.78rem;
          color: #668085;
          margin: 3px 0 0 0;
        }

        .view-all-link-btn {
          background: transparent;
          border: none;
          color: #39AEA9;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: gap 0.2s ease;
        }

        .view-all-link-btn:hover {
          gap: 7px;
          color: #163E36;
        }

        [data-theme="dark"] .view-all-link-btn:hover {
          color: #A2D5AB;
        }

        .timeline-interactive-container {
          display: flex;
          align-items: stretch;
          gap: 18px;
        }

        /* Vertical Stepped Track */
        .timeline-vertical-track {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 24px;
          padding: 16px 0;
          flex-shrink: 0;
        }

        .timeline-node {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .timeline-node.node-double {
          border: 2px solid #163E36;
          background: #ffffff;
        }

        [data-theme="dark"] .timeline-node.node-double {
          border-color: #A2D5AB;
          background: #142325;
        }

        .node-inner-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #163E36;
        }

        [data-theme="dark"] .node-inner-dot {
          background: #A2D5AB;
        }

        .timeline-node.node-filled {
          background: #163E36;
        }

        [data-theme="dark"] .timeline-node.node-filled {
          background: #39AEA9;
        }

        .timeline-node.node-open {
          border: 2px solid #557B83;
          background: transparent;
        }

        .timeline-connector-line {
          width: 2px;
          flex: 1;
          background: rgba(85, 123, 131, 0.24);
          margin: 4px 0;
        }

        /* Stepped Items Stack */
        .timeline-cards-list {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .pipeline-stepped-item {
          border-radius: 16px;
          padding: 14px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          transition: all 0.2s ease;
          border: 1px solid rgba(85, 123, 131, 0.12);
        }

        .pipeline-stepped-item.step-session {
          background: linear-gradient(135deg, rgba(162, 213, 171, 0.22) 0%, rgba(229, 239, 193, 0.28) 100%);
        }

        .pipeline-stepped-item.step-security {
          background: linear-gradient(135deg, rgba(229, 239, 193, 0.28) 0%, rgba(162, 213, 171, 0.16) 100%);
        }

        .pipeline-stepped-item.step-workflow {
          background: linear-gradient(135deg, rgba(237, 243, 237, 0.9) 0%, rgba(229, 239, 193, 0.24) 100%);
        }

        .pipeline-stepped-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(22, 62, 54, 0.08);
        }

        .pipeline-item-info {
          flex: 1;
          min-width: 0;
        }

        .stepped-item-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 3px;
        }

        .pipeline-item-title {
          font-size: 0.94rem;
          font-weight: 800;
          color: #163E36;
          margin: 0;
        }

        [data-theme="dark"] .pipeline-item-title {
          color: #102d27;
        }

        .pipeline-item-subtitle {
          font-size: 0.78rem;
          color: #435b60;
          margin: 0 0 4px 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pipeline-item-lessons {
          font-size: 0.72rem;
          font-weight: 600;
          color: #557B83;
        }

        .pipeline-item-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }

        .pipeline-status-tag {
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          padding: 4px 10px;
          border-radius: 6px;
          display: inline-block;
        }

        .pipeline-status-tag.status-active {
          background: rgba(16, 185, 129, 0.2);
          color: #047857;
        }

        .pipeline-status-tag.status-verified {
          background: rgba(57, 174, 169, 0.2);
          color: #163E36;
        }

        .pipeline-status-tag.status-ready {
          background: #163E36;
          color: #ffffff;
        }

        .pipeline-action-circle {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: none;
          background: rgba(22, 62, 54, 0.12);
          color: #163E36;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.18s ease;
        }

        .pipeline-action-circle:hover {
          transform: scale(1.12);
          background: #163E36;
          color: #ffffff;
        }

        /* ----------------------------------------------------
           DEDICATED TABS (ACTIVE SESSIONS, SECURITY AUDIT)
           ---------------------------------------------------- */
        .dedicated-tab-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .session-manager-card,
        .audit-manager-card {
          padding: 24px 26px;
        }

        .tab-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 22px;
          flex-wrap: wrap;
        }

        .tab-panel-title {
          font-size: 1.3rem;
          font-weight: 800;
          color: #163E36;
          margin: 0 0 4px 0;
          font-family: var(--font-display, 'Outfit', sans-serif);
        }

        [data-theme="dark"] .tab-panel-title {
          color: #e2f2eb;
        }

        .tab-panel-desc {
          font-size: 0.84rem;
          color: #668085;
          margin: 0;
        }

        .tab-header-buttons {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .btn-refresh-sessions {
          padding: 8px 14px;
          border-radius: 10px;
          border: 1px solid rgba(85, 123, 131, 0.25);
          background: #ffffff;
          color: #2c4246;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.18s ease;
        }

        [data-theme="dark"] .btn-refresh-sessions {
          background: #182c2e;
          border-color: rgba(162, 213, 171, 0.25);
          color: #d1dfdc;
        }

        .btn-refresh-sessions:hover {
          border-color: #39AEA9;
          color: #163E36;
        }

        .btn-logout-all {
          padding: 8px 14px;
          border-radius: 10px;
          border: 1px solid rgba(225, 29, 72, 0.25);
          background: rgba(225, 29, 72, 0.08);
          color: #E11D48;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: all 0.18s ease;
        }

        .btn-logout-all:hover {
          background: #E11D48;
          color: #ffffff;
        }

        /* Sessions Rows */
        .sessions-list-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .session-row-card {
          padding: 16px 20px;
          border-radius: 16px;
          border: 1px solid rgba(85, 123, 131, 0.16);
          background: #f8faf8;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          transition: all 0.2s ease;
        }

        [data-theme="dark"] .session-row-card {
          background: #111e20;
          border-color: rgba(85, 123, 131, 0.3);
        }

        .session-row-card.current-device {
          background: rgba(162, 213, 171, 0.16);
          border-color: #A2D5AB;
        }

        [data-theme="dark"] .session-row-card.current-device {
          background: rgba(57, 174, 169, 0.14);
          border-color: rgba(57, 174, 169, 0.4);
        }

        .session-dev-icon-col {
          flex-shrink: 0;
        }

        .session-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: #163E36;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        [data-theme="dark"] .session-icon-box {
          background: #1b3d36;
          color: #A2D5AB;
        }

        .session-dev-details-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .session-dev-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .session-browser-tag {
          font-size: 0.8rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 6px;
        }

        .session-os-tag {
          font-size: 0.78rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 6px;
          background: rgba(85, 123, 131, 0.1);
          color: #2c4246;
        }

        [data-theme="dark"] .session-os-tag {
          background: rgba(255, 255, 255, 0.08);
          color: #cad8d5;
        }

        .this-device-badge {
          font-size: 0.7rem;
          font-weight: 700;
          color: #10B981;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.35);
          border-radius: 9999px;
          padding: 2px 8px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }

        .session-meta-row {
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 0.76rem;
          color: #668085;
          flex-wrap: wrap;
        }

        .session-meta-row span {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .session-action-col {
          flex-shrink: 0;
        }

        .btn-revoke-session {
          padding: 6px 12px;
          border-radius: 8px;
          background: rgba(225, 29, 72, 0.08);
          border: 1px solid rgba(225, 29, 72, 0.25);
          color: #E11D48;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: all 0.18s ease;
        }

        .btn-revoke-session:hover {
          background: #E11D48;
          color: #ffffff;
        }

        .active-badge-pill {
          font-size: 0.76rem;
          font-weight: 700;
          color: #10B981;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 9999px;
          padding: 4px 10px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        /* History Audit rows */
        .history-list-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .history-event-row {
          padding: 14px 18px;
          border-radius: 14px;
          border: 1px solid rgba(85, 123, 131, 0.14);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          background: #f8faf8;
        }

        [data-theme="dark"] .history-event-row {
          background: #111e20;
          border-color: rgba(85, 123, 131, 0.28);
        }

        .history-event-row.status-success {
          border-left: 4px solid #10B981;
        }

        .history-event-row.status-failed {
          border-left: 4px solid #EF4444;
        }

        .history-icon-box {
          flex-shrink: 0;
        }

        .history-details-box {
          flex: 1;
        }

        .history-title-line {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .history-status-label {
          font-size: 0.84rem;
          font-weight: 700;
          color: #163E36;
        }

        [data-theme="dark"] .history-status-label {
          color: #e2f2eb;
        }

        .history-method-tag {
          font-size: 0.72rem;
          padding: 2px 7px;
          border-radius: 6px;
          background: rgba(57, 174, 169, 0.14);
          color: #163E36;
          font-weight: 600;
        }

        [data-theme="dark"] .history-method-tag {
          background: rgba(162, 213, 171, 0.18);
          color: #A2D5AB;
        }

        .history-reason-text {
          font-size: 0.76rem;
          color: #EF4444;
        }

        .history-meta-line {
          font-size: 0.76rem;
          color: #8da1a4;
          margin-top: 3px;
        }

        .history-timestamp {
          font-size: 0.76rem;
          color: #8da1a4;
          flex-shrink: 0;
        }

        /* ----------------------------------------------------
           MODAL: EDIT PROFILE & PHOTO
           ---------------------------------------------------- */
        .edit-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(18, 51, 44, 0.6);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
          padding: 20px;
        }

        .edit-modal-window {
          width: 100%;
          max-width: 500px;
          background: #ffffff;
          border-radius: 22px;
          padding: 26px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
          animation: modalPop 0.22s ease-out;
        }

        [data-theme="dark"] .edit-modal-window {
          background: #142325;
          color: #e5f0ec;
        }

        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .modal-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }

        .modal-title-box {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .modal-heading {
          font-size: 1.2rem;
          font-weight: 800;
          color: #163E36;
          margin: 0;
          font-family: var(--font-display, 'Outfit', sans-serif);
        }

        [data-theme="dark"] .modal-heading {
          color: #e2f2eb;
        }

        .modal-close-btn {
          background: transparent;
          border: none;
          color: #8da1a4;
          cursor: pointer;
          padding: 6px;
          border-radius: 8px;
          transition: background 0.18s ease;
        }

        .modal-close-btn:hover {
          background: rgba(0, 0, 0, 0.05);
          color: #163E36;
        }

        .modal-alert {
          padding: 10px 14px;
          border-radius: 10px;
          font-size: 0.84rem;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .modal-alert.alert-success {
          background: rgba(16, 185, 129, 0.12);
          color: #10B981;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .modal-alert.alert-error {
          background: rgba(239, 68, 68, 0.12);
          color: #EF4444;
          border: 1px solid rgba(239, 68, 68, 0.25);
        }

        .modal-form-content {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .modal-input-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .modal-field-label {
          font-size: 0.84rem;
          font-weight: 700;
          color: #163E36;
        }

        [data-theme="dark"] .modal-field-label {
          color: #cad8d5;
        }

        .modal-text-control {
          padding: 10px 14px;
          border-radius: 12px;
          border: 1.5px solid rgba(85, 123, 131, 0.22);
          background: #f8faf8;
          font-size: 0.9rem;
          color: #152224;
          outline: none;
          transition: border-color 0.2s ease;
        }

        [data-theme="dark"] .modal-text-control {
          background: #0f1d1f;
          border-color: rgba(85, 123, 131, 0.35);
          color: #e5f0ec;
        }

        .modal-text-control:focus {
          border-color: #39AEA9;
        }

        .modal-text-control.disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .modal-dropzone {
          border: 2px dashed rgba(85, 123, 131, 0.3);
          border-radius: 16px;
          padding: 16px 18px;
          background: #f8faf8;
          display: flex;
          align-items: center;
          gap: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        [data-theme="dark"] .modal-dropzone {
          background: #0f1d1f;
          border-color: rgba(85, 123, 131, 0.38);
        }

        .modal-dropzone.dropzone-dragging {
          border-color: #39AEA9;
          background: rgba(57, 174, 169, 0.1);
        }

        .dropzone-avatar-preview {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          overflow: hidden;
          border: 2px solid #39AEA9;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
          flex-shrink: 0;
        }

        .preview-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .dropzone-text-col {
          flex: 1;
          min-width: 0;
        }

        .dropzone-main-text {
          font-size: 0.88rem;
          font-weight: 700;
          color: #163E36;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        [data-theme="dark"] .dropzone-main-text {
          color: #A2D5AB;
        }

        .dropzone-sub-text {
          font-size: 0.74rem;
          color: #8da1a4;
          margin-top: 3px;
        }

        .dropzone-actions-col {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn-modal-browse {
          padding: 6px 12px;
          border-radius: 8px;
          border: 1px solid rgba(85, 123, 131, 0.25);
          background: #ffffff;
          color: #163E36;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
        }

        [data-theme="dark"] .btn-modal-browse {
          background: #182c2e;
          color: #e5f0ec;
        }

        .btn-modal-remove {
          padding: 6px 10px;
          border-radius: 8px;
          border: 1px solid rgba(239, 68, 68, 0.25);
          background: rgba(239, 68, 68, 0.08);
          color: #EF4444;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .modal-linked-box {
          padding: 12px 14px;
          border-radius: 12px;
          background: #f1f6f2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.8rem;
        }

        [data-theme="dark"] .modal-linked-box {
          background: #0f1d1f;
        }

        .linked-title {
          font-weight: 700;
          color: #163E36;
        }

        [data-theme="dark"] .linked-title {
          color: #cad8d5;
        }

        .linked-chips-row {
          display: flex;
          gap: 6px;
        }

        .linked-chip {
          padding: 3px 8px;
          border-radius: 6px;
          background: #ffffff;
          font-weight: 600;
          font-size: 0.74rem;
          color: #163E36;
          border: 1px solid rgba(85, 123, 131, 0.16);
        }

        [data-theme="dark"] .linked-chip {
          background: #182c2e;
          color: #A2D5AB;
        }

        .modal-actions-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 6px;
        }

        .btn-modal-cancel {
          padding: 9px 16px;
          border-radius: 12px;
          border: 1px solid rgba(85, 123, 131, 0.22);
          background: transparent;
          color: #668085;
          font-weight: 600;
          cursor: pointer;
        }

        .btn-modal-save {
          padding: 9px 20px;
          border-radius: 12px;
          border: none;
          background: #163E36;
          color: #ffffff;
          font-weight: 800;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: background 0.2s ease;
        }

        .btn-modal-save:hover {
          background: #1B4D3E;
        }

        /* ----------------------------------------------------
           RESPONSIVE BREAKPOINTS (TABLETS & PHONES)
           ---------------------------------------------------- */
        @media (max-width: 1040px) {
          .profile-app-frame {
            flex-direction: column;
            gap: 18px;
          }

          .profile-sidebar {
            width: 100%;
            border-radius: 20px;
            padding: 14px 18px;
          }

          .sidebar-nav {
            flex-direction: row;
            overflow-x: auto;
            padding-bottom: 4px;
          }

          .sidebar-nav-item {
            width: auto;
            white-space: nowrap;
          }

          .sidebar-footer-artwork {
            display: none;
          }

          .profile-content-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .profile-page-wrapper {
            padding: 12px 10px 40px 10px;
          }

          .user-card-body {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          .user-meta-row {
            justify-content: center;
          }

          .canvas-search-pill {
            display: none;
          }

          .timeline-interactive-container {
            flex-direction: column;
          }

          .timeline-vertical-track {
            display: none;
          }

          .pipeline-stepped-item {
            flex-direction: column;
            align-items: flex-start;
          }

          .pipeline-item-actions {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
}
