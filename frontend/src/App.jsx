import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import AuthModal from "./components/AuthModal";
import ProfilePage from "./components/ProfilePage";
import WorkflowList from "./components/workflow/WorkflowList";
import WorkflowEditor from "./components/workflow/WorkflowEditor";
import ExecutionReportsList from "./components/workflow/ExecutionReportsList";
import ExecutionReportDetail from "./components/workflow/ExecutionReportDetail";
import WorkspaceModal from "./components/workflow/WorkspaceModal";
import { api, BACKEND_URL } from "./services/api";

export default function App() {
  const [user, setUser] = useState(api.currentUser);
  const [activeView, setActiveView] = useState("home"); // "home" | "workflows" | "workflow-editor" | "runs" | "run-report" | "profile"
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState("login");
  const [authModalError, setAuthModalError] = useState(null);
  const [authModalSuccess, setAuthModalSuccess] = useState(null);
  const [backendHealth, setBackendHealth] = useState(null);

  // Shared Workspace Collaboration State
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceModalOpen, setWorkspaceModalOpen] = useState(false);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  const resolveRoute = () => {
    const pathname = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get("view");
    const runIdParam = params.get("runId");

    if (pathname.startsWith("/runs/")) {
      const runId = pathname.slice(6).split("/")[0].trim();
      if (runId) {
        return { view: "run-report", runId, workflowId: null };
      }
    }
    if (pathname === "/runs") {
      if (runIdParam) {
        return { view: "run-report", runId: runIdParam, workflowId: null };
      }
      return { view: "runs", runId: null, workflowId: null };
    }
    if (pathname.startsWith("/workflows/")) {
      const wfId = pathname.slice(11).split("/")[0].trim();
      if (wfId) {
        return { view: "workflow-editor", runId: null, workflowId: wfId };
      }
    }
    if (pathname === "/workflows") {
      return { view: "workflows", runId: null, workflowId: null };
    }
    if (pathname === "/profile") {
      return { view: "profile", runId: null, workflowId: null };
    }
    if (viewParam) {
      if (viewParam === "run-report" && runIdParam) {
        return { view: "run-report", runId: runIdParam, workflowId: null };
      }
      return { view: viewParam, runId: runIdParam || null, workflowId: null };
    }
    return { view: "home", runId: null, workflowId: null };
  };

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

    // Initial Path Route Resolution
    const initialRoute = resolveRoute();
    setActiveView(initialRoute.view);
    if (initialRoute.runId) setSelectedRunId(initialRoute.runId);
    if (initialRoute.workflowId) setSelectedWorkflowId(initialRoute.workflowId);

    const handlePopState = () => {
      const route = resolveRoute();
      setActiveView(route.view);
      setSelectedRunId(route.runId);
      if (route.workflowId) setSelectedWorkflowId(route.workflowId);
    };
    window.addEventListener("popstate", handlePopState);

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const refreshToken = params.get("refreshToken");
    const errorParam = params.get("error");
    const verifiedParam = params.get("verified");

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
            handleNavigateView("workflows");
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
            handleNavigateView("workflows");
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

    const inviteToken = params.get("inviteToken");
    if (inviteToken) {
      setWorkspaceModalOpen(true);
    }

    if (api.accessToken) {
      api.getProfile()
        .then((res) => setUser(res.data))
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("auth:expired", handleAuthExpired);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const refreshWorkspaces = async () => {
    if (!api.accessToken) {
      setWorkspaces([]);
      setPendingInvitesCount(0);
      return;
    }
    try {
      const [wsRes, invitesRes] = await Promise.all([
        api.listWorkspaces().catch(() => ({ data: [] })),
        api.listUserInvitations().catch(() => ({ data: [] })),
      ]);
      const list = wsRes.data || [];
      setWorkspaces(list);
      setPendingInvitesCount((invitesRes.data || []).length);
      setActiveWorkspace((prev) => {
        if (!prev) return list[0] || null;
        const found = list.find((w) => w.id === prev.id);
        return found || list[0] || null;
      });
    } catch (err) {
      console.warn("Failed to refresh workspaces:", err);
    }
  };

  useEffect(() => {
    if (user) {
      refreshWorkspaces();
    } else {
      setActiveWorkspace(null);
      setWorkspaces([]);
      setPendingInvitesCount(0);
    }
  }, [user?.id]);

  const handleOpenAuth = (tab = "login") => {
    setAuthModalTab(tab);
    setAuthModalError(null);
    setAuthModalSuccess(null);
    setAuthModalOpen(true);
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    handleNavigateView("workflows");
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setActiveWorkspace(null);
    setWorkspaces([]);
    setSelectedWorkflowId(null);
    setSelectedRunId(null);
    handleNavigateView("home");
  };

  const handleNavigateView = (view) => {
    setSelectedWorkflowId(null);
    setSelectedRunId(null);
    setActiveView(view);
    const path = view === "home" ? "/" : `/${view}`;
    try {
      window.history.pushState({}, "", path);
    } catch {
      // ignore
    }
  };

  const handleOpenWorkflow = (id) => {
    setSelectedWorkflowId(id);
    setSelectedRunId(null);
    setActiveView("workflow-editor");
    try {
      window.history.pushState({}, "", `/workflows/${id}`);
    } catch {
      // ignore
    }
  };

  const handleBackToWorkflows = () => {
    setSelectedWorkflowId(null);
    setActiveView("workflows");
    try {
      window.history.pushState({}, "", "/workflows");
    } catch {
      // ignore
    }
  };

  const handleOpenReport = (runId) => {
    setSelectedRunId(runId);
    setActiveView("run-report");
    try {
      window.history.pushState({}, "", `/runs/${runId}`);
    } catch {
      // ignore
    }
  };

  const handleBackToReports = () => {
    setSelectedRunId(null);
    setActiveView("runs");
    try {
      window.history.pushState({}, "", "/runs");
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
          setActiveView={handleNavigateView}
          onOpenAuth={handleOpenAuth}
          onLogout={handleLogout}
          backendHealth={backendHealth}
          activeWorkspace={activeWorkspace}
          workspaces={workspaces}
          onSelectWorkspace={setActiveWorkspace}
          onOpenWorkspaceModal={() => setWorkspaceModalOpen(true)}
          pendingInvitesCount={pendingInvitesCount}
        />
      )}

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {activeView === "home" ? (
          <Hero 
            user={user}
            onOpenAuth={handleOpenAuth}
            onNavigateProfile={() => handleNavigateView("workflows")}
          />
        ) : activeView === "profile" ? (
          <ProfilePage 
            user={user}
            onUserUpdated={(updated) => setUser(updated)}
            onLogout={handleLogout}
            onNavigateView={handleNavigateView}
          />
        ) : activeView === "workflows" ? (
          <WorkflowList
            user={user}
            activeWorkspace={activeWorkspace}
            onOpenWorkspaceModal={() => setWorkspaceModalOpen(true)}
            onOpenWorkflow={handleOpenWorkflow}
            onOpenAuth={handleOpenAuth}
          />
        ) : activeView === "workflow-editor" ? (
          <WorkflowEditor
            workflowId={selectedWorkflowId}
            activeWorkspace={activeWorkspace}
            onBack={handleBackToWorkflows}
            onOpenReport={handleOpenReport}
          />
        ) : activeView === "runs" ? (
          <ExecutionReportsList
            user={user}
            onOpenReport={handleOpenReport}
            onNavigateWorkflows={() => handleNavigateView("workflows")}
            onOpenAuth={handleOpenAuth}
          />
        ) : activeView === "run-report" ? (
          <ExecutionReportDetail
            runId={selectedRunId}
            onBack={handleBackToReports}
            onOpenWorkflow={handleOpenWorkflow}
            onOpenAuth={handleOpenAuth}
          />
        ) : null}
      </main>

      <WorkspaceModal
        isOpen={workspaceModalOpen}
        onClose={() => setWorkspaceModalOpen(false)}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={(ws) => setActiveWorkspace(ws)}
        onWorkspacesChanged={refreshWorkspaces}
      />

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
