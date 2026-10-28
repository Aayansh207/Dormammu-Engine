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

  async getLoginHistory(page = 1, limit = 10) {
    return this.request(`/sessions/history?page=${page}&limit=${limit}`, { method: "GET" });
  }

  // --- Workspaces & Invitations ---

  async listWorkspaces() {
    return this.request("/workspaces", { method: "GET" });
  }

  async getWorkspace(id) {
    return this.request(`/workspaces/${id}`, { method: "GET" });
  }

  async createWorkspace({ name, description }) {
    return this.request("/workspaces", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
  }

  async updateWorkspace(id, { name, description }) {
    return this.request(`/workspaces/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, description }),
    });
  }

  async deleteWorkspace(id) {
    return this.request(`/workspaces/${id}`, {
      method: "DELETE",
    });
  }

  async listWorkspaceWorkflows(id) {
    return this.request(`/workspaces/${id}/workflows`, { method: "GET" });
  }

  async inviteWorkspaceMember(id, { email, role }) {
    return this.request(`/workspaces/${id}/invitations`, {
      method: "POST",
      body: JSON.stringify({ email, role }),
    });
  }

  async listWorkspaceInvitations(id) {
    return this.request(`/workspaces/${id}/invitations`, { method: "GET" });
  }

  async revokeWorkspaceInvitation(id, invitationId) {
    return this.request(`/workspaces/${id}/invitations/${invitationId}`, {
      method: "DELETE",
    });
  }

  async listUserInvitations() {
    return this.request("/workspaces/invitations/me", { method: "GET" });
  }

  async acceptWorkspaceInvitation(token) {
    return this.request("/workspaces/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  async rejectWorkspaceInvitation(token) {
    return this.request("/workspaces/invitations/reject", {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }

  async removeWorkspaceMember(id, memberUserId) {
    return this.request(`/workspaces/${id}/members/${memberUserId}`, {
      method: "DELETE",
    });
  }

  async updateWorkspaceMemberRole(id, memberUserId, role) {
    return this.request(`/workspaces/${id}/members/${memberUserId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
  }

  // --- Workflows, Nodes & Runs ---

  async listWorkflows(workspaceId = null) {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
    return this.request(`/workflows${query}`, { method: "GET" });
  }

  async getWorkflow(id) {
    return this.request(`/workflows/${id}`, { method: "GET" });
  }

  async createWorkflow(data) {
    return this.request("/workflows", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateWorkflow(id, data) {
    return this.request(`/workflows/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteWorkflow(id) {
    return this.request(`/workflows/${id}`, {
      method: "DELETE",
    });
  }

  async validateSavedWorkflow(id) {
    return this.request(`/workflows/${id}/validate`, {
      method: "POST",
    });
  }

  async validateRawWorkflow(definition) {
    return this.request("/workflows/validate", {
      method: "POST",
      body: JSON.stringify({ definition }),
    });
  }

  async executeWorkflow(id, payload = {}) {
    return this.request(`/workflows/${id}/runs`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async listWorkflowRuns(id) {
    return this.request(`/workflows/${id}/runs`, {
      method: "GET",
    });
  }

  async getWorkflowSchedule(id) {
    return this.request(`/workflows/${id}/schedule`, {
      method: "GET",
    });
  }

  async updateWorkflowSchedule(id, scheduleData = {}) {
    return this.request(`/workflows/${id}/schedule`, {
      method: "POST",
      body: JSON.stringify(scheduleData),
    });
  }

  async deleteWorkflowSchedule(id) {
    return this.request(`/workflows/${id}/schedule`, {
      method: "DELETE",
    });
  }

  async listAllRuns({ page = 1, limit = 20, status = "", triggerType = "", search = "" } = {}) {
    let url = `/runs?page=${page}&limit=${limit}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    if (triggerType) url += `&triggerType=${encodeURIComponent(triggerType)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    return this.request(url, { method: "GET" });
  }

  async getRunDetails(runId) {
    return this.request(`/runs/${runId}`, {
      method: "GET",
    });
  }

  async getRun(runId) {
    return this.getRunDetails(runId);
  }

  async getRunReport(runId) {
    return this.request(`/runs/${runId}/report`, {
      method: "GET",
    });
  }

  async getRunTasks(runId) {
    return this.request(`/runs/${runId}/tasks`, {
      method: "GET",
    });
  }

  async getNodeCatalogue() {
    return this.request("/nodes", { method: "GET" });
  }

  async getNodeMetadata(type) {
    return this.request(`/nodes/${type}`, { method: "GET" });
  }

  // --- Workflow Version History & Restoration ---

  async listWorkflowVersions(workflowId) {
    return this.request(`/workflows/${workflowId}/versions`, { method: "GET" });
  }

  async getWorkflowVersion(workflowId, version) {
    return this.request(`/workflows/${workflowId}/versions/${version}`, { method: "GET" });
  }

  async restoreWorkflowVersion(workflowId, version) {
    return this.request(`/workflows/${workflowId}/versions/${version}/restore`, {
      method: "POST",
    });
  }

  // --- Real-Time Collaboration WebSocket URL ---

  getCollaborationWsUrl(workflowId) {
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = BACKEND_URL.replace(/^https?:\/\//, "");
    const token = this.accessToken ? encodeURIComponent(this.accessToken) : "";
    return `${wsProtocol}//${host}/ws/collaboration?workflowId=${encodeURIComponent(workflowId)}&token=${token}`;
  }

  getRunEventsUrl(runId) {
    const token = this.accessToken ? encodeURIComponent(this.accessToken) : "";
    return `${API_BASE}/runs/${runId}/events${token ? `?token=${token}` : ""}`;
  }

  getWebhookUrl(workflowId, isAsync = false) {
    return `${API_BASE}/webhooks/${workflowId}${isAsync ? "?async=true" : ""}`;
  }

  async sendWebhook(workflowId, payload, token = null, isAsync = false) {
    const url = this.getWebhookUrl(workflowId, isAsync);
    const headers = { "Content-Type": "application/json" };
    if (token) {
      headers["x-webhook-token"] = token;
    }
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    return {
      status: response.status,
      ok: response.ok,
      data,
    };
  }

  subscribeToRunEvents(runId, onEvent, onError) {
    const url = this.getRunEventsUrl(runId);
    const eventSource = new EventSource(url);

    const taskEvents = ["task:ready", "task:running", "task:succeeded", "task:failed", "task:blocked", "task:skipped", "task:cancelled"];
    for (const evt of taskEvents) {
      eventSource.addEventListener(evt, (e) => {
        try {
          const parsed = JSON.parse(e.data);
          const eventObj = parsed && typeof parsed === "object" ? { ...parsed, type: evt } : { type: evt, data: parsed };
          onEvent?.(evt, eventObj);
        } catch (err) {
          console.error("SSE parse error for", evt, err);
        }
      });
    }

    eventSource.addEventListener("workflow:started", (e) => {
      try {
        const parsed = JSON.parse(e.data);
        const eventObj = parsed && typeof parsed === "object" ? { ...parsed, type: "workflow:started" } : { type: "workflow:started", data: parsed };
        onEvent?.("workflow:started", eventObj);
      } catch (err) {}
    });

    eventSource.addEventListener("workflow:completed", (e) => {
      try {
        const parsed = JSON.parse(e.data);
        const eventObj = parsed && typeof parsed === "object" ? { ...parsed, type: "workflow:completed" } : { type: "workflow:completed", data: parsed };
        onEvent?.("workflow:completed", eventObj);
      } catch (err) {}
      eventSource.close();
    });

    eventSource.addEventListener("connected", (e) => {
      try {
        const parsed = JSON.parse(e.data);
        const eventObj = parsed && typeof parsed === "object" ? { ...parsed, type: "connected" } : { type: "connected", data: parsed };
        onEvent?.("connected", eventObj);
      } catch (err) {}
    });

    eventSource.onerror = (err) => {
      onError?.(err);
    };

    return () => {
      eventSource.close();
    };
  }
}

export const api = new ApiService();
export default api;

