import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import AuthModal from "./components/AuthModal";
import ProfilePage from "./components/ProfilePage";
import WorkflowList from "./components/workflow/WorkflowList";
import WorkflowEditor from "./components/workflow/WorkflowEditor";
import { api, BACKEND_URL } from "./services/api";

export default function App() {
  const [user, setUser] = useState(api.currentUser);
  const [activeView, setActiveView] = useState("home"); // "home" | "workflows" | "workflow-editor" | "profile"
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState("login");
  const [authModalError, setAuthModalError] = useState(null);
  const [authModalSuccess, setAuthModalSuccess] = useState(null);
  const [backendHealth, setBackendHealth] = useState(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/health/db`)
      .then((res) => res.json())
      .then((data) => setBackendHealth(data.success))
      .catch(() => setBackendHealth(false));

    const handleAuthExpired = () => {
      setUser(null);
      setActiveView("home");
      setAuthModalTab("login");
      setAuthModalError(null);
      setAuthModalSuccess(null);
      setAuthModalOpen(true);
    };
    window.addEventListener("auth:expired", handleAuthExpired);

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const refreshToken = params.get("refreshToken");
    const errorParam = params.get("error");
    const verifiedParam = params.get("verified");
    const viewParam = params.get("view");

    if (viewParam) {
      setActiveView(viewParam);
    }

    if (errorParam) {
      setAuthModalTab("login");
      setAuthModalError(decodeURIComponent(errorParam));
      setAuthModalSuccess(null);
      setAuthModalOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (token && refreshToken) {
      // Auto sign-in (e.g. from email verification link or Google OAuth)
      api.setSession(token, refreshToken, null);
      api.getProfile()
        .then((res) => {
          if (res?.data) {
            api.setSession(token, refreshToken, res.data);
            setUser(res.data);
            setActiveView("workflows");
            setAuthModalOpen(false);
          }
        })
        .catch((err) => {
          setAuthModalTab("login");
          setAuthModalError(err.message || "Failed to load account session");
          setAuthModalOpen(true);
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    } else if (verifiedParam) {
      setAuthModalTab("login");
      setAuthModalError(null);
      setAuthModalSuccess(
        verifiedParam === "already"
          ? "Your email is already verified! Please sign in with your credentials."
          : "🎉 Email verified successfully! Your account is now active. Please sign in."
      );
      setAuthModalOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (token && !refreshToken) {
      api.verifyEmail(token)
        .then((res) => {
          if (res?.accessToken && res?.refreshToken) {
            api.setSession(res.accessToken, res.refreshToken, res.user);
            setUser(res.user);
            setActiveView("workflows");
            setAuthModalOpen(false);
          } else {
            setAuthModalTab("login");
            setAuthModalError(null);
            setAuthModalSuccess("🎉 Email verified successfully! Please sign in.");
            setAuthModalOpen(true);
          }
        })
        .catch((err) => {
          setAuthModalTab("login");
          setAuthModalError(err.message || "Verification failed");
          setAuthModalOpen(true);
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }

    if (api.accessToken) {
      api.getProfile()
        .then((res) => setUser(res.data))
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("auth:expired", handleAuthExpired);
    };
  }, []);

  const handleOpenAuth = (tab = "login") => {
    setAuthModalTab(tab);
    setAuthModalError(null);
    setAuthModalSuccess(null);
    setAuthModalOpen(true);
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    setActiveView("workflows");
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setSelectedWorkflowId(null);
    setActiveView("home");
    try {
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch {
      // ignore
    }
  };

  const handleOpenWorkflow = (id) => {
    setSelectedWorkflowId(id);
    setActiveView("workflow-editor");
  };

  const handleBackToWorkflows = () => {
    setSelectedWorkflowId(null);
    setActiveView("workflows");
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("runId")) {
        url.searchParams.delete("runId");
        window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ""));
      }
    } catch {
      // ignore
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="ambient-bg" />

      {activeView !== "workflow-editor" && (
        <Navbar 
          user={user}
          activeView={activeView}
          setActiveView={setActiveView}
          onOpenAuth={handleOpenAuth}
          onLogout={handleLogout}
          backendHealth={backendHealth}
        />
      )}

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {activeView === "home" ? (
          <Hero 
            user={user}
            onOpenAuth={handleOpenAuth}
            onNavigateProfile={() => setActiveView("workflows")}
          />
        ) : activeView === "profile" ? (
          <ProfilePage 
            user={user}
            onUserUpdated={(updated) => setUser(updated)}
            onLogout={handleLogout}
            onNavigateView={setActiveView}
          />
        ) : activeView === "workflows" ? (
          <WorkflowList
            user={user}
            onOpenWorkflow={handleOpenWorkflow}
            onOpenAuth={handleOpenAuth}
          />
        ) : activeView === "workflow-editor" ? (
          <WorkflowEditor
            workflowId={selectedWorkflowId}
            onBack={handleBackToWorkflows}
          />
        ) : null}
      </main>

      <AuthModal 
        isOpen={authModalOpen}
        initialTab={authModalTab}
        initialError={authModalError}
        initialSuccess={authModalSuccess}
        onClose={() => {
          setAuthModalOpen(false);
          setAuthModalError(null);
          setAuthModalSuccess(null);
        }}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
