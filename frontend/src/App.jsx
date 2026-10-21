import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import AuthModal from "./components/AuthModal";
import ProfilePage from "./components/ProfilePage";
import { api } from "./services/api";

export default function App() {
  const [user, setUser] = useState(api.currentUser);
  const [activeView, setActiveView] = useState("home");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState("login");
  const [authModalError, setAuthModalError] = useState(null);
  const [backendHealth, setBackendHealth] = useState(null);

  useEffect(() => {
    const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:5001";
    fetch(`${backendUrl}/health/db`)
      .then((res) => res.json())
      .then((data) => setBackendHealth(data.success))
      .catch(() => setBackendHealth(false));

    const handleAuthExpired = () => {
      setUser(null);
      setActiveView("home");
      setAuthModalTab("login");
      setAuthModalError(null);
      setAuthModalOpen(true);
    };
    window.addEventListener("auth:expired", handleAuthExpired);

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const refreshToken = params.get("refreshToken");
    const errorParam = params.get("error");

    if (errorParam) {
      setAuthModalTab("login");
      setAuthModalError(decodeURIComponent(errorParam));
      setAuthModalOpen(true);
      window.history.replaceState({}, document.title, "/");
    } else if (token && refreshToken) {
      api.setSession(token, refreshToken, null);
      api.getProfile()
        .then((res) => {
          if (res?.data) {
            api.setSession(token, refreshToken, res.data);
            setUser(res.data);
            setActiveView("profile");
          }
        })
        .catch((err) => {
          setAuthModalTab("login");
          setAuthModalError(err.message || "Failed to load profile after Google sign in");
          setAuthModalOpen(true);
        })
        .finally(() => {
          window.history.replaceState({}, document.title, "/");
        });
    } else if (token && !refreshToken) {
      api.verifyEmail(token)
        .then(() => {
          setAuthModalTab("login");
          setAuthModalOpen(true);
        })
        .catch(() => {
          setAuthModalTab("login");
          setAuthModalOpen(true);
        })
        .finally(() => {
          window.history.replaceState({}, document.title, "/");
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
    setAuthModalOpen(true);
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    setActiveView("profile");
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setActiveView("home");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="ambient-bg" />

      <Navbar 
        user={user}
        activeView={activeView}
        setActiveView={setActiveView}
        onOpenAuth={handleOpenAuth}
        onLogout={handleLogout}
        backendHealth={backendHealth}
      />

      <main style={{ flex: 1 }}>
        {activeView === "home" ? (
          <Hero 
            user={user}
            onOpenAuth={handleOpenAuth}
            onNavigateProfile={() => setActiveView("profile")}
          />
        ) : (
          <ProfilePage 
            user={user}
            onUserUpdated={(updated) => setUser(updated)}
            onLogout={handleLogout}
          />
        )}
      </main>

      <AuthModal 
        isOpen={authModalOpen}
        initialTab={authModalTab}
        initialError={authModalError}
        onClose={() => {
          setAuthModalOpen(false);
          setAuthModalError(null);
        }}
        onAuthSuccess={handleAuthSuccess}
      />
    </div>
  );
}
