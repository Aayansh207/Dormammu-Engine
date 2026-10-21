export const BACKEND_URL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, "");
export const API_BASE = `${BACKEND_URL}/api`;


class ApiService {
  constructor() {
    this.accessToken = localStorage.getItem("dormammu_access_token") || null;
    this.refreshToken = localStorage.getItem("dormammu_refresh_token") || null;
    this.currentUser = null;

    try {
      const stored = localStorage.getItem("dormammu_user");
      if (stored) this.currentUser = JSON.parse(stored);
    } catch (e) {
      this.currentUser = null;
    }
  }

  setSession(accessToken, refreshToken, user) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.currentUser = user;

    if (accessToken) localStorage.setItem("dormammu_access_token", accessToken);
    else localStorage.removeItem("dormammu_access_token");

    if (refreshToken) localStorage.setItem("dormammu_refresh_token", refreshToken);
    else localStorage.removeItem("dormammu_refresh_token");

    if (user) localStorage.setItem("dormammu_user", JSON.stringify(user));
    else localStorage.removeItem("dormammu_user");
  }

  clearSession() {
    this.accessToken = null;
    this.refreshToken = null;
    this.currentUser = null;
    localStorage.removeItem("dormammu_access_token");
    localStorage.removeItem("dormammu_refresh_token");
    localStorage.removeItem("dormammu_user");
  }

  async request(endpoint, options = {}, isRetry = false) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      // Handle token expiration and auto-refresh
      if (response.status === 401 && !isRetry && this.refreshToken && endpoint !== "/auth/refresh") {
        const refreshSuccess = await this.refreshTokens();
        if (refreshSuccess) {
          return this.request(endpoint, options, true);
        } else {
          this.clearSession();
          window.dispatchEvent(new CustomEvent("auth:expired"));
        }
      }

      if (!response.ok) {
        const error = new Error(data.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      throw err;
    }
  }

  async refreshTokens() {
    try {
      if (!this.refreshToken) return false;
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (data.data?.accessToken) {
        this.setSession(
          data.data.accessToken,
          data.data.refreshToken || this.refreshToken,
          data.data.user || this.currentUser
        );
        return true;
      }
      return false;
    } catch (err) {
      return false;
    }
  }

  // --- Auth Endpoints ---

  async signup({ name, email, password }) {
    return this.request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  }

  async login({ email, password }) {
    const res = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    if (res.data) {
      this.setSession(res.data.accessToken, res.data.refreshToken, res.data.user);
    }
    return res;
  }

  async verifyEmail(token) {
    return this.request("/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  async resendVerification(email) {
    return this.request("/auth/resend-verification", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async googleAuth(idToken) {
    const res = await this.request("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
    if (res.data) {
      this.setSession(res.data.accessToken, res.data.refreshToken, res.data.user);
    }
    return res;
  }

  async logout() {
    try {
      if (this.refreshToken) {
        await this.request("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });
      }
    } finally {
      this.clearSession();
    }
  }

  async logoutAll() {
    try {
      await this.request("/auth/logout-all", {
        method: "POST",
      });
    } finally {
      this.clearSession();
    }
  }

  // --- User Profile ---

  async getProfile() {
    const res = await this.request("/users/me", { method: "GET" });
    if (res.data) {
      this.currentUser = res.data;
      localStorage.setItem("dormammu_user", JSON.stringify(res.data));
    }
    return res;
  }

  async updateProfile({ name, profilePhoto }) {
    const res = await this.request("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ name, profilePhoto }),
    });
    if (res.data) {
      this.currentUser = res.data;
      localStorage.setItem("dormammu_user", JSON.stringify(res.data));
    }
    return res;
  }

  async uploadAvatar(file) {
    const formData = new FormData();
    formData.append("avatar", file);

    const url = `${API_BASE}/users/me/avatar`;
    const headers = {};
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: formData,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data.message || "Failed to upload avatar");
      err.status = response.status;
      err.data = data;
      throw err;
    }

    if (data.data) {
      this.currentUser = data.data;
      localStorage.setItem("dormammu_user", JSON.stringify(data.data));
    }

    return data;
  }

  async changePassword({ currentPassword, newPassword }) {
    return this.request("/users/me/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // --- Sessions & History ---

  async getSessions() {
    return this.request("/sessions", { method: "GET" });
  }

  async revokeSession(id) {
    return this.request(`/sessions/${id}`, { method: "DELETE" });
  }

  async getLoginHistory(page = 1, limit = 20) {
    return this.request(`/users/me/login-history?page=${page}&limit=${limit}`, {
      method: "GET",
    });
  }
}

export const api = new ApiService();
