// Read API base URL from the environment (Vite exposes .env via import.meta.env)
// The backend registers its routers at the root path (e.g. /auth, /admin/projects,
// /public/projects), so no additional version prefix is prepended here.
const API_BASE_URL =
  (import.meta.env && (import.meta.env.VITE_API_URL || import.meta.env.EXPO_PUBLIC_API_URL)) ||
  "http://127.0.0.1:8000";

export interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  is_active: boolean;
  is_verified: boolean;
  role: string;
  permissions: string[];
}

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName?: string, lastName?: string, phone?: string) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  loginStatus: "idle" | "loading" | "authenticated" | "unauthenticated";
}

let authToken: string | null = null;
let _refreshPromise: Promise<string | null> | null = null;

// API client for authentication calls
export async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  const token = authToken || localStorage.getItem("access_token");
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Auto-refresh on 401 (skip for login/register/refresh endpoints to avoid loops)
  if (response.status === 401 && !endpoint.startsWith("/auth/")) {
    const refreshed = await _tryRefreshToken();
    if (refreshed) {
      headers.Authorization = `Bearer ${refreshed}`;
      return fetch(url, { ...options, headers });
    }
  }

  return response;
}

async function _tryRefreshToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return null;

  // Deduplicate concurrent refresh attempts
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      const url = `${API_BASE_URL}/auth/refresh`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) {
        _clearAuthState();
        return null;
      }
      const data = await res.json();
      authToken = data.access_token;
      localStorage.setItem("access_token", data.access_token);
      if (data.refresh_token) {
        localStorage.setItem("refresh_token", data.refresh_token);
      }
      return data.access_token as string;
    } catch {
      _clearAuthState();
      return null;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

function _clearAuthState(): void {
  authToken = null;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_email");
  // Dispatch a custom event so authStore can react
  window.dispatchEvent(new CustomEvent("auth:unauthenticated"));
}

export async function login(email: string, password: string): Promise<User> {
  const response = await apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Login failed");
  }

  const data = await response.json();
  authToken = data.access_token;
  
  // Store user info and tokens
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  
  const user = data.user || getUserFromToken(data.access_token);
  // JWT may not contain email; use the login email as fallback
  if (user && !user.email) {
    user.email = email;
  }
  localStorage.setItem("user_email", email);
  return user;
}

export async function register(
  email: string,
  password: string,
  firstName?: string,
  lastName?: string,
  phone?: string
): Promise<User> {
  const response = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName, phone }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Registration failed");
  }

  const data = await response.json();
  authToken = data.access_token;
  
  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);
  
  return data.user || getUserFromToken(data.access_token);
}

export async function logout(): Promise<void> {
  const refreshToken = localStorage.getItem("refresh_token");
  // Revoke the server-side session before clearing local state.
  // Best-effort: if the backend call fails (e.g. token already expired)
  // we still clear the client-side state.
  if (refreshToken) {
    try {
      await apiRequest("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Ignore — server may already have revoked the session.
    }
  }
  authToken = null;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_email");
}

export async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) {
    return null;
  }

  const response = await apiRequest("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Token refresh failed");
  }

  const data = await response.json();
  authToken = data.access_token;
  localStorage.setItem("access_token", data.access_token);
  if (data.refresh_token) {
    localStorage.setItem("refresh_token", data.refresh_token);
  }
  
  return data.access_token;
}

export function getAuthToken(): string | null {
  return authToken || localStorage.getItem("access_token");
}

export function setAuthToken(token: string | null): void {
  authToken = token;
  if (token) {
    localStorage.setItem("access_token", token);
  } else {
    localStorage.removeItem("access_token");
  }
}

export function getUserFromToken(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // JWT may not contain email; fall back to localStorage
    const storedEmail = localStorage.getItem("user_email") || "";
    return {
      id: payload.sub || 0,
      email: payload.email || storedEmail,
      first_name: payload.first_name,
      last_name: payload.last_name,
      phone: payload.phone,
      is_active: payload.is_active ?? true,
      is_verified: payload.is_verified ?? false,
      role: payload.role || "user",
      permissions: payload.permissions || [],
    };
  } catch (e) {
    return null;
  }
}

/**
 * Validate the current access token against the backend.
 * Returns the server-confirmed user info if valid, or null if
 * the token is expired / revoked / the server is unreachable.
 */
export async function validateToken(): Promise<User | null> {
  try {
    const response = await apiRequest("/auth/me");
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return {
      id: data.id,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      phone: data.phone,
      is_active: data.is_active,
      is_verified: data.is_verified,
      role: data.role,
      permissions: data.permissions || [],
    };
  } catch {
    return null;
  }
}

// ============================================================
// Phase 4: Projects API
// ============================================================

export interface Project {
  id: number;
  project_number: string;
  contract_id?: number;
  lead_id?: number;
  quotation_id?: number;
  title: string;
  acronym?: string;
  description?: string;
  status: string;
  priority: string;
  manager_id?: number;
  manager_name?: string;
  contract_number?: string;
  lead_number?: string;
  contact_name?: string;
  start_date?: string;
  target_end_date?: string;
  actual_end_date?: string;
  full_budget?: number;
  reserved_budget?: number;
  customer_budget?: number;
  currency: string;
  secure_reference: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  tasks_count: number;
  tasks_done: number;
  members_count: number;
  milestones_count: number;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: number;
  role: string;
  is_lead: boolean;
  status: string;
  joined_at?: string;
  user_name?: string;
  created_at: string;
}

export interface Milestone {
  id: number;
  project_id: number;
  name: string;
  description?: string;
  due_date?: string;
  status: string;
  completed_at?: string;
  display_order: number;
  created_at: string;
  tasks_count: number;
}

export interface TaskItem {
  id: number;
  project_id: number;
  milestone_id?: number;
  title: string;
  description?: string;
  assignee_id?: number;
  assignee_name?: string;
  status: string;
  priority: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  completed_at?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  author_id: number;
  author_name?: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface ProjectUpdateItem {
  id: number;
  project_id: number;
  author_id: number;
  author_name?: string;
  title: string;
  content?: string;
  update_type: string;
  status?: string;
  is_internal: boolean;
  is_user_visible: boolean;
  created_at: string;
}

export async function fetchProjects(
  status?: string,
  priority?: string,
  manager_id?: number,
  search?: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ projects: Project[]; total: number }> {
  const params = new URLSearchParams();
  if (status) params.append("status_filter", status);
  if (priority) params.append("priority", priority);
  if (manager_id) params.append("manager_id", String(manager_id));
  if (search) params.append("search", search);
  params.append("page", String(page));
  params.append("page_size", String(pageSize));

  const response = await apiRequest(`/admin/projects?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load projects");
  }
  return response.json();
}

export async function getProject(projectId: number): Promise<Project> {
  const response = await apiRequest(`/admin/projects/${projectId}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load project");
  }
  return response.json();
}

export async function createProject(data: Partial<Project>): Promise<Project> {
  const response = await apiRequest("/admin/projects/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create project");
  }
  return response.json();
}

export async function updateProject(projectId: number, data: Partial<Project>): Promise<Project> {
  const response = await apiRequest(`/admin/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update project");
  }
  return response.json();
}

export async function changeProjectStatus(projectId: number, status: string): Promise<Project> {
  const response = await apiRequest(`/admin/projects/${projectId}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to change project status");
  }
  return response.json();
}

export async function assignProjectManager(projectId: number, manager_id: number): Promise<Project> {
  const response = await apiRequest(`/admin/projects/${projectId}/assign-manager`, {
    method: "POST",
    body: JSON.stringify({ manager_id }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to assign project manager");
  }
  return response.json();
}

export async function fetchProjectMembers(projectId: number): Promise<ProjectMember[]> {
  const response = await apiRequest(`/admin/projects/${projectId}/members`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load project members");
  }
  return response.json();
}

export async function addProjectMember(projectId: number, data: { user_id: number; role: string; is_lead?: boolean }): Promise<ProjectMember> {
  const response = await apiRequest(`/admin/projects/${projectId}/members`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to add member");
  }
  return response.json();
}

export async function removeProjectMember(projectId: number, memberId: number): Promise<void> {
  const response = await apiRequest(`/admin/projects/${projectId}/members/${memberId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to remove member");
  }
}

export async function fetchMilestones(projectId: number): Promise<Milestone[]> {
  const response = await apiRequest(`/admin/projects/${projectId}/milestones`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load milestones");
  }
  return response.json();
}

export async function createMilestone(projectId: number, data: Partial<Milestone>): Promise<Milestone> {
  const response = await apiRequest(`/admin/projects/${projectId}/milestones`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create milestone");
  }
  return response.json();
}

export async function updateMilestone(projectId: number, milestoneId: number, data: Partial<Milestone>): Promise<Milestone> {
  const response = await apiRequest(`/admin/projects/${projectId}/milestones/${milestoneId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update milestone");
  }
  return response.json();
}

export async function fetchTasks(
  projectId: number,
  milestoneId?: number,
  assigneeId?: number,
  status?: string
): Promise<TaskItem[]> {
  const params = new URLSearchParams();
  if (milestoneId) params.append("milestone_id", String(milestoneId));
  if (assigneeId) params.append("assignee_id", String(assigneeId));
  if (status) params.append("status_filter", status);

  const query = params.toString();
  const response = await apiRequest(`/admin/projects/${projectId}/tasks${query ? `?${query}` : ""}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load tasks");
  }
  return response.json();
}

export async function createTask(projectId: number, data: Partial<TaskItem>): Promise<TaskItem> {
  const response = await apiRequest(`/admin/projects/${projectId}/tasks`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create task");
  }
  return response.json();
}

export async function updateTask(projectId: number, taskId: number, data: Partial<TaskItem>): Promise<TaskItem> {
  const response = await apiRequest(`/admin/projects/${projectId}/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update task");
  }
  return response.json();
}

export async function deleteTask(projectId: number, taskId: number): Promise<void> {
  const response = await apiRequest(`/admin/projects/${projectId}/tasks/${taskId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to delete task");
  }
}

export async function fetchTaskComments(projectId: number, taskId: number): Promise<TaskComment[]> {
  const response = await apiRequest(`/admin/projects/${projectId}/tasks/${taskId}/comments`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load task comments");
  }
  return response.json();
}

export async function addTaskComment(projectId: number, taskId: number, content: string, is_internal: boolean = true): Promise<TaskComment> {
  const response = await apiRequest(`/admin/projects/${projectId}/tasks/${taskId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content, is_internal }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to add comment");
  }
  return response.json();
}

export async function fetchProjectUpdates(projectId: number, userVisibleOnly: boolean = false): Promise<ProjectUpdateItem[]> {
  const params = userVisibleOnly ? "?user_visible_only=true" : "";
  const response = await apiRequest(`/admin/projects/${projectId}/updates${params}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load updates");
  }
  return response.json();
}

export async function createProjectUpdate(projectId: number, data: Partial<ProjectUpdateItem>): Promise<ProjectUpdateItem> {
  const response = await apiRequest(`/admin/projects/${projectId}/updates`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create update");
  }
  return response.json();
}

export async function fetchPublicProject(secureReference: string): Promise<any> {
  const response = await apiRequest(`/public/projects/${secureReference}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load project");
  }
  return response.json();
}

export interface QuoteRequest {
  id: number;
  request_number: string;
  status: string;
  created_at: string;
}

export async function fetchQuoteRequests(): Promise<QuoteRequest[]> {
  const response = await apiRequest("/admin/quote-requests");
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load quote requests");
  }
  return response.json();
}

// ============================================================
// Public quote request + project type catalog (public submit)
// ============================================================

export interface ProjectTypeSummary {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  display_order: number;
}

export interface ProjectSubcategorySummary {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  is_active: boolean;
  display_order: number;
  project_type_id?: number;
}

export interface QuoteRequestPayload {
  project_type_name: string;
  subcategory_name: string;
  project_type_slug: string;
  subcategory_slug: string;
  name: string;
  email: string;
  phone?: string | null;
  whatsapp?: string | null;
  company_name?: string | null;
  designation?: string | null;
  budget?: string | null;
  timeline?: string | null;
  target_audience?: string | null;
  existing_system?: string | null;
  expected_launch?: string | null;
  detailed_requirements?: string | null;
  source?: string;
}

export interface QuoteRequestResult {
  id: number;
  request_number: string;
  status: string;
  created_at: string;
}

export async function listProjectTypes(): Promise<ProjectTypeSummary[]> {
  const response = await apiRequest("/admin/project-types/?active_only=true&limit=100");
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load project types");
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function listProjectSubcategories(projectTypeId: number): Promise<ProjectSubcategorySummary[]> {
  const response = await apiRequest(`/admin/project-types/${projectTypeId}/subcategories?active_only=true`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load project subcategories");
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function submitQuoteRequest(payload: QuoteRequestPayload): Promise<QuoteRequestResult> {
  const response = await apiRequest("/admin/quote-requests/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to submit quote request");
  }
  return response.json();
}

// Admin detail: the backend detail endpoint currently returns only
// id / request_number / status / created_at (a documented backend
// limitation). Full requirement fields are not yet exposed.
export async function getQuoteRequest(quoteRequestId: number): Promise<QuoteRequest> {
  const response = await apiRequest(`/admin/quote-requests/${quoteRequestId}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load quote request");
  }
  return response.json();
}

export async function updateQuoteRequest(quoteRequestId: number, status: string): Promise<QuoteRequest> {
  const response = await apiRequest(`/admin/quote-requests/${quoteRequestId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update quote request");
  }
  return response.json();
}

// ============================================================
// Admin: Project Types + Subcategories CRUD
// ============================================================

export interface ProjectTypeInput {
  name: string;
  slug: string;
  description?: string | null;
  is_active?: boolean;
  display_order?: number;
}

export async function createProjectType(data: ProjectTypeInput): Promise<ProjectTypeSummary> {
  const response = await apiRequest("/admin/project-types/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create project type");
  }
  return response.json();
}

export async function updateProjectType(typeId: number, data: Partial<ProjectTypeInput>): Promise<ProjectTypeSummary> {
  const response = await apiRequest(`/admin/project-types/${typeId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update project type");
  }
  return response.json();
}

export async function deleteProjectType(typeId: number): Promise<void> {
  const response = await apiRequest(`/admin/project-types/${typeId}`, { method: "DELETE" });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to deactivate project type");
  }
}

function extractApiError(errorData: any): string {
  if (typeof errorData?.detail === "string") return errorData.detail;
  if (Array.isArray(errorData?.detail)) {
    return errorData.detail.map((d: any) => d.msg || String(d)).join(". ");
  }
  return "An unexpected error occurred";
}

export async function listSubcategories(projectTypeId: number): Promise<ProjectSubcategorySummary[]> {
  const response = await apiRequest(`/admin/project-types/${projectTypeId}/subcategories?active_only=false`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(extractApiError(errorData) || "Failed to load subcategories");
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function createSubcategory(
  projectTypeId: number,
  data: { name: string; slug: string; description?: string | null }
): Promise<ProjectSubcategorySummary> {
  const response = await apiRequest(`/admin/project-types/${projectTypeId}/subcategories`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(extractApiError(errorData) || "Failed to create subcategory");
  }
  return response.json();
}

// ============================================================
// Admin: Requirement Questions CRUD
// ============================================================

export interface RequirementQuestion {
  id: number;
  question: string;
  field_key: string;
  field_type: string;
  is_required: boolean;
  options?: string[] | null;
  display_order: number;
  is_active: boolean;
  project_type_id?: number | null;
  subcategory_id?: number | null;
}

export interface RequirementQuestionInput {
  question: string;
  field_key: string;
  field_type: string;
  is_required?: boolean;
  options?: string[] | null;
  display_order?: number;
  is_active?: boolean;
  project_type_id?: number | null;
  subcategory_id?: number | null;
}

export async function listRequirementQuestions(projectTypeId?: number): Promise<RequirementQuestion[]> {
  const params = new URLSearchParams();
  if (projectTypeId) params.append("project_type_id", String(projectTypeId));
  const response = await apiRequest(`/admin/requirement-questions/?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load requirement questions");
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function createRequirementQuestion(data: RequirementQuestionInput): Promise<RequirementQuestion> {
  const response = await apiRequest("/admin/requirement-questions/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create requirement question");
  }
  return response.json();
}

export async function updateRequirementQuestion(
  questionId: number,
  data: Partial<RequirementQuestionInput>
): Promise<RequirementQuestion> {
  const response = await apiRequest(`/admin/requirement-questions/${questionId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update requirement question");
  }
  return response.json();
}

export async function toggleRequirementQuestion(questionId: number): Promise<void> {
  const response = await apiRequest(`/admin/requirement-questions/${questionId}/toggle`, {
    method: "PATCH",
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to toggle requirement question");
  }
}

// ============================================================
// Phase 2/3: Leads, Quotations, Contracts API
// ============================================================

export interface Lead {
  id: number;
  lead_number: string;
  status: string;
  priority: string;
  contact_name: string;
  contact_email: string;
  project_type?: string | null;
  subcategory?: string | null;
  owner_name?: string | null;
  created_at: string;
  next_follow_up_at?: string | null;
}

export interface Quotation {
  id: number;
  quotation_number: string;
  lead_id?: number | null;
  contact_id?: number | null;
  title: string;
  version: string;
  status: string;
  currency: string;
  subtotal: number;
  discount: number;
  discount_type: string;
  tax: number;
  total: number;
  validity_days: number;
  valid_until?: string | null;
  estimated_timeline?: string | null;
  payment_terms?: string | null;
  terms_and_conditions?: string | null;
  customer_message?: string | null;
  items_count: number;
  created_at: string;
  updated_at: string;
}

export interface Contract {
  id: number;
  contract_number: string;
  quotation_id?: number | null;
  quotation_version: string;
  lead_id?: number | null;
  contact_id?: number | null;
  title: string;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  scope?: string | null;
  deliverables?: string | null;
  payment_terms?: string | null;
  terms_and_conditions?: string | null;
  sent_at?: string | null;
  accepted_at?: string | null;
  expired_at?: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchLeads(
  status?: string,
  priority?: string,
  projectType?: string | number,
  owner?: string | number,
  search?: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ leads: Lead[]; total: number }> {
  const params = new URLSearchParams();
  params.append("skip", String((page - 1) * pageSize));
  params.append("limit", String(pageSize));
  if (status) params.append("status", status);
  if (priority) params.append("priority", priority);
  if (projectType) params.append("project_type_id", String(projectType));
  if (owner) params.append("owner_id", String(owner));
  if (search) params.append("contact_email", search);

  const response = await apiRequest(`/admin/leads?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load leads");
  }
  return response.json();
}

export async function fetchLeadDetail(leadId: number): Promise<{ lead: any; contact: any }> {
  const response = await apiRequest(`/admin/leads/${leadId}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load lead");
  }
  const data = await response.json();

  const nameParts = (data.contact_name || "").split(" ").filter(Boolean);
  const contact = {
    first_name: nameParts[0] || data.contact_name || "—",
    last_name: nameParts.slice(1).join(" ") || "",
    email: data.contact_email || "",
    phone: null,
    whatsapp: null,
    company_name: null,
  };

  const lead = {
    id: data.id,
    lead_number: data.lead_number,
    status: data.status,
    priority: data.priority,
    source: "website",
    contact_id: data.contact_id ?? null,
    created_at: data.created_at ? new Date(data.created_at) : null,
    next_follow_up_at: data.next_follow_up_at ? new Date(data.next_follow_up_at) : null,
    project_type: data.project_type ? { name: data.project_type } : null,
    subcategory: data.subcategory ? { name: data.subcategory } : null,
    quote_request: null,
  };

  return { lead, contact };
}

export async function fetchTechnicalAnalysis(_leadId: number): Promise<{ technical_analysis: any }> {
  const response = await apiRequest(`/admin/technical-analyses?lead_id=${_leadId}`);
  if (!response.ok) {
    return { technical_analysis: null };
  }
  const data = await response.json();
  return { technical_analysis: Array.isArray(data) && data.length > 0 ? data[0] : data };
}

export async function fetchEstimation(_leadId: number): Promise<{ estimation: any }> {
  const response = await apiRequest(`/admin/estimations?lead_id=${_leadId}`);
  if (!response.ok) {
    return { estimation: null };
  }
  const data = await response.json();
  return { estimation: Array.isArray(data) && data.length > 0 ? data[0] : data };
}

export async function listQuotations(
  status?: string,
  leadId?: number,
  page: number = 1,
  pageSize: number = 50
): Promise<{ quotations: Quotation[]; total: number }> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (leadId) params.append("lead_id", String(leadId));
  params.append("skip", String((page - 1) * pageSize));
  params.append("limit", String(pageSize));

  const response = await apiRequest(`/admin/quotations?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load quotations");
  }
  const data = await response.json();
  return { quotations: Array.isArray(data) ? (data as Quotation[]) : [], total: Array.isArray(data) ? (data as Quotation[]).length : 0 };
}

export async function getQuotation(quotationId: number): Promise<Quotation> {
  const response = await apiRequest(`/admin/quotations/${quotationId}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load quotation");
  }
  return response.json();
}

export async function listContracts(
  status?: string,
  page: number = 1,
  pageSize: number = 50,
  leadId?: number
): Promise<{ contracts: Contract[]; total: number }> {
  const params = new URLSearchParams();
  if (status) params.append("status", status);
  if (leadId) params.append("lead_id", String(leadId));

  const response = await apiRequest(`/admin/contracts?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load contracts");
  }
  const data = await response.json();
  return { contracts: Array.isArray(data) ? (data as Contract[]) : [], total: Array.isArray(data) ? (data as Contract[]).length : 0 };
}

export async function getContract(contractId: number): Promise<Contract> {
  const response = await apiRequest(`/admin/contracts/${contractId}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load contract");
  }
  return response.json();
}

// ============================================================
// Phase 3: Invoices & Payments API
// ============================================================

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  item_type: string;
  name: string;
  description?: string | null;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  discount: number;
  tax: number;
  total: number;
  display_order: number;
  notes?: string | null;
}

export interface Invoice {
  id: number;
  invoice_number: string;
  contract_id?: number | null;
  project_id?: number | null;
  quotation_id?: number | null;
  lead_id?: number | null;
  contact_id?: number | null;
  title: string;
  description?: string | null;
  status: string;
  issue_date: string;
  due_date?: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  discount_type: string;
  tax: number;
  total: number;
  amount_paid: number;
  balance: number;
  secure_reference: string;
  notes?: string | null;
  sent_at?: string | null;
  paid_at?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
  items_count: number;
  payments_total: number;
  items: InvoiceItem[];
}

export interface Payment {
  id: number;
  payment_number: string;
  invoice_id?: number | null;
  contract_id?: number | null;
  project_id?: number | null;
  invoice_number?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  amount: number;
  currency: string;
  method: string;
  reference?: string | null;
  status: string;
  paid_at?: string | null;
  received_by?: number | null;
  created_at: string;
  updated_at: string;
}

export async function fetchInvoices(
  status?: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ invoices: Invoice[]; total: number }> {
  const params = new URLSearchParams();
  if (status) params.append("status_filter", status);
  params.append("page", String(page));
  params.append("page_size", String(pageSize));
  const response = await apiRequest(`/admin/invoices/?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load invoices");
  }
  return response.json();
}

export async function getInvoice(invoiceId: number): Promise<Invoice> {
  const response = await apiRequest(`/admin/invoices/${invoiceId}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load invoice");
  }
  return response.json();
}

export async function createInvoice(data: Partial<Invoice> & { items?: Partial<InvoiceItem>[] }): Promise<Invoice> {
  const response = await apiRequest("/admin/invoices/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create invoice");
  }
  return response.json();
}

export async function updateInvoice(invoiceId: number, data: Partial<Invoice>): Promise<Invoice> {
  const response = await apiRequest(`/admin/invoices/${invoiceId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update invoice");
  }
  return response.json();
}

export async function sendInvoice(invoiceId: number): Promise<Invoice> {
  const response = await apiRequest(`/admin/invoices/${invoiceId}/send`, {
    method: "POST",
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to send invoice");
  }
  return response.json();
}

export async function cancelInvoice(invoiceId: number): Promise<Invoice> {
  const response = await apiRequest(`/admin/invoices/${invoiceId}/cancel`, {
    method: "POST",
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to cancel invoice");
  }
  return response.json();
}

export async function addInvoiceItem(invoiceId: number, data: Partial<InvoiceItem>): Promise<InvoiceItem> {
  const response = await apiRequest(`/admin/invoices/${invoiceId}/items`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to add invoice item");
  }
  return response.json();
}

export async function removeInvoiceItem(invoiceId: number, itemId: number): Promise<void> {
  const response = await apiRequest(`/admin/invoices/${invoiceId}/items/${itemId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to remove invoice item");
  }
}

export async function fetchPayments(
  invoiceId?: number,
  status?: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ payments: Payment[]; total: number }> {
  const params = new URLSearchParams();
  if (invoiceId) params.append("invoice_id", String(invoiceId));
  if (status) params.append("status_filter", status);
  params.append("page", String(page));
  params.append("page_size", String(pageSize));
  const response = await apiRequest(`/admin/payments?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load payments");
  }
  return response.json();
}

export async function createPayment(data: Partial<Payment> & { metadata?: Record<string, unknown> }): Promise<Payment> {
  const response = await apiRequest("/admin/payments", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create payment");
  }
  return response.json();
}

// ============================================================
// Phase 3: Support API
// ============================================================

export interface SupportMessage {
  id: number;
  ticket_id: number;
  author_id?: number | null;
  author_name?: string | null;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: number;
  ticket_number: string;
  subject: string;
  description?: string | null;
  status: string;
  priority: string;
  category?: string | null;
  contact_id?: number | null;
  contact_name?: string | null;
  contact_email?: string | null;
  project_id?: number | null;
  contract_id?: number | null;
  assignee_id?: number | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  closed_at?: string | null;
  message_count: number;
  messages: SupportMessage[];
}

export async function fetchSupportTickets(
  status?: string,
  priority?: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ tickets: SupportTicket[]; total: number }> {
  const params = new URLSearchParams();
  if (status) params.append("status_filter", status);
  if (priority) params.append("priority", priority);
  params.append("page", String(page));
  params.append("page_size", String(pageSize));
  const response = await apiRequest(`/admin/support/tickets?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load support tickets");
  }
  return response.json();
}

export async function getSupportTicket(ticketId: number): Promise<SupportTicket> {
  const response = await apiRequest(`/admin/support/tickets/${ticketId}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load support ticket");
  }
  return response.json();
}

export async function createSupportTicket(data: Partial<SupportTicket>): Promise<SupportTicket> {
  const response = await apiRequest("/admin/support/tickets", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create support ticket");
  }
  return response.json();
}

export async function updateSupportTicket(ticketId: number, data: Partial<SupportTicket>): Promise<SupportTicket> {
  const response = await apiRequest(`/admin/support/tickets/${ticketId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update support ticket");
  }
  return response.json();
}

export async function addSupportMessage(ticketId: number, data: { content: string; is_internal: boolean; author_name?: string }): Promise<SupportMessage> {
  const response = await apiRequest(`/admin/support/tickets/${ticketId}/messages`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to add message");
  }
  return response.json();
}

// ============================================================
// Phase 3: Notifications API
// ============================================================

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  body?: string | null;
  notification_type: string;
  related_entity?: string | null;
  related_id?: number | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export async function fetchNotifications(unreadOnly: boolean = false, page: number = 1, pageSize: number = 50): Promise<{ notifications: Notification[]; unread_count: number; total: number }> {
  const params = new URLSearchParams();
  if (unreadOnly) params.append("unread_only", "true");
  params.append("page", String(page));
  params.append("page_size", String(pageSize));
  const response = await apiRequest(`/admin/notifications/?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load notifications");
  }
  return response.json();
}

export async function markNotificationRead(notificationId: number): Promise<Notification> {
  const response = await apiRequest(`/admin/notifications/${notificationId}/read`, { method: "POST" });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to mark notification read");
  }
  return response.json();
}

export async function markAllNotificationsRead(): Promise<void> {
  const response = await apiRequest("/admin/notifications/read-all", { method: "POST" });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to mark notifications read");
  }
}

// ============================================================
// Phase 3: Calendar & Automation API
// ============================================================

export interface CalendarEvent {
  id: number;
  title: string;
  description?: string | null;
  event_type: string;
  starts_at: string;
  ends_at?: string | null;
  all_day: boolean;
  location?: string | null;
  participant_ids?: number[] | null;
  related_entity?: string | null;
  related_id?: number | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

export async function fetchCalendarEvents(start?: string, end?: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  if (start) params.append("start", start);
  if (end) params.append("end", end);
  const query = params.toString();
  const response = await apiRequest(`/admin/calendar?${query}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load calendar events");
  }
  return response.json();
}

export async function createCalendarEvent(data: Partial<CalendarEvent>): Promise<CalendarEvent> {
  const response = await apiRequest("/admin/calendar/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create event");
  }
  return response.json();
}

export async function deleteCalendarEvent(eventId: number): Promise<void> {
  const response = await apiRequest(`/admin/calendar/${eventId}`, { method: "DELETE" });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to delete event");
  }
}

export interface AutomationRule {
  id: number;
  name: string;
  description?: string | null;
  trigger_event: string;
  condition?: Record<string, unknown> | null;
  action: { channels?: string[]; recipients?: unknown[]; template?: string };
  is_active: boolean;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  runs_count: number;
  last_run_status?: string | null;
}

export interface AutomationRun {
  id: number;
  rule_id: number;
  rule_name?: string | null;
  trigger_event: string;
  related_entity?: string | null;
  related_id?: number | null;
  status: string;
  channels?: string[] | null;
  error?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export async function fetchAutomationRules(): Promise<AutomationRule[]> {
  const response = await apiRequest("/admin/automation/rules");
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load automation rules");
  }
  return response.json();
}

export async function createAutomationRule(data: Partial<AutomationRule>): Promise<AutomationRule> {
  const response = await apiRequest("/admin/automation/rules", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create rule");
  }
  return response.json();
}

export async function updateAutomationRule(ruleId: number, data: Partial<AutomationRule>): Promise<AutomationRule> {
  const response = await apiRequest(`/admin/automation/rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update rule");
  }
  return response.json();
}

export async function deleteAutomationRule(ruleId: number): Promise<void> {
  const response = await apiRequest(`/admin/automation/rules/${ruleId}`, { method: "DELETE" });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to delete rule");
  }
}

export async function fetchAutomationRuns(page: number = 1, pageSize: number = 50): Promise<{ runs: AutomationRun[]; total: number }> {
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("page_size", String(pageSize));
  const response = await apiRequest(`/admin/automation/runs?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load automation runs");
  }
  return response.json();
}

// ============================================================
// Phase 4: Products / Releases / Roadmap / Prototypes API
// ============================================================

export interface Product {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  status: string;
  current_version?: string | null;
  platform?: string[] | null;
  tags?: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  versions_count: number;
  releases_count: number;
  roadmap_items_count: number;
}

export interface ProductVersion {
  id: number;
  product_id: number;
  version: string;
  name?: string | null;
  notes?: string | null;
  changelog?: string | null;
  status: string;
  release_date?: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchProducts(
  status?: string,
  search?: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ products: Product[]; total: number }> {
  const params = new URLSearchParams();
  if (status) params.append("status_filter", status);
  if (search) params.append("search", search);
  params.append("page", String(page));
  params.append("page_size", String(pageSize));
  const response = await apiRequest(`/admin/products?${params.toString()}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load products");
  }
  return response.json();
}

export async function createProduct(data: Partial<Product>): Promise<Product> {
  const response = await apiRequest("/admin/products/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create product");
  }
  return response.json();
}

export async function updateProduct(productId: number, data: Partial<Product>): Promise<Product> {
  const response = await apiRequest(`/admin/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update product");
  }
  return response.json();
}

export async function fetchProductVersions(productId: number): Promise<ProductVersion[]> {
  const response = await apiRequest(`/admin/products/${productId}/versions`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load versions");
  }
  return response.json();
}

export async function createProductVersion(data: Partial<ProductVersion>): Promise<ProductVersion> {
  const response = await apiRequest("/admin/products/versions", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create version");
  }
  return response.json();
}

export interface ProductRelease {
  id: number;
  product_id: number;
  product_name?: string | null;
  version_id?: number | null;
  version_version?: string | null;
  name: string;
  release_notes?: string | null;
  status: string;
  environment: string;
  scheduled_for?: string | null;
  released_at?: string | null;
  rolled_back_at?: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchReleases(productId?: number): Promise<ProductRelease[]> {
  const params = new URLSearchParams();
  if (productId) params.append("product_id", String(productId));
  const query = params.toString();
  const response = await apiRequest(`/admin/releases?${query}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load releases");
  }
  return response.json();
}

export async function createRelease(data: Partial<ProductRelease>): Promise<ProductRelease> {
  const response = await apiRequest("/admin/releases/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create release");
  }
  return response.json();
}

export async function updateRelease(releaseId: number, data: Partial<ProductRelease>): Promise<ProductRelease> {
  const response = await apiRequest(`/admin/releases/${releaseId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update release");
  }
  return response.json();
}

export async function markReleaseReleased(releaseId: number): Promise<ProductRelease> {
  const response = await apiRequest(`/admin/releases/${releaseId}/release`, { method: "POST" });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to mark release released");
  }
  return response.json();
}

export async function rollbackRelease(releaseId: number): Promise<ProductRelease> {
  const response = await apiRequest(`/admin/releases/${releaseId}/rollback`, { method: "POST" });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to rollback release");
  }
  return response.json();
}

export interface RoadmapItem {
  id: number;
  product_id?: number | null;
  product_name?: string | null;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  category: string;
  target_quarter?: string | null;
  due_date?: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export async function fetchRoadmapItems(
  status?: string,
  priority?: string,
  targetQuarter?: string
): Promise<RoadmapItem[]> {
  const params = new URLSearchParams();
  if (status) params.append("status_filter", status);
  if (priority) params.append("priority", priority);
  if (targetQuarter) params.append("target_quarter", targetQuarter);
  const query = params.toString();
  const response = await apiRequest(`/admin/roadmap?${query}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load roadmap items");
  }
  return response.json();
}

export async function createRoadmapItem(data: Partial<RoadmapItem>): Promise<RoadmapItem> {
  const response = await apiRequest("/admin/roadmap/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create roadmap item");
  }
  return response.json();
}

export async function updateRoadmapItem(itemId: number, data: Partial<RoadmapItem>): Promise<RoadmapItem> {
  const response = await apiRequest(`/admin/roadmap/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update roadmap item");
  }
  return response.json();
}

export interface Prototype {
  id: number;
  name: string;
  description?: string | null;
  project_id?: number | null;
  product_id?: number | null;
  project_name?: string | null;
  product_name?: string | null;
  prototype_type: string;
  status: string;
  storage_key?: string | null;
  image_url?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchPrototypes(status?: string): Promise<Prototype[]> {
  const params = new URLSearchParams();
  if (status) params.append("status_filter", status);
  const query = params.toString();
  const response = await apiRequest(`/admin/prototypes?${query}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load prototypes");
  }
  return response.json();
}

export async function createPrototype(data: Partial<Prototype>): Promise<Prototype> {
  const response = await apiRequest("/admin/prototypes/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create prototype");
  }
  return response.json();
}

export async function updatePrototype(prototypeId: number, data: Partial<Prototype>): Promise<Prototype> {
  const response = await apiRequest(`/admin/prototypes/${prototypeId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to update prototype");
  }
  return response.json();
}

// ============================================================
// Feature Flags API
// ============================================================

export interface FeatureFlag {
  id: number;
  key: string;
  label: string;
  description?: string | null;
  is_enabled: boolean;
  scope: string;
  created_at: string;
  updated_at: string;
}

export interface PublicConfig {
  flags: FeatureFlag[];
}

export async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  const response = await apiRequest("/admin/feature-flags");
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to load feature flags");
  }
  return response.json();
}

export async function createFeatureFlag(data: Partial<FeatureFlag>): Promise<FeatureFlag> {
  const response = await apiRequest("/admin/feature-flags/", {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to create feature flag");
  }
  return response.json();
}

export async function toggleFeatureFlag(flagId: number): Promise<FeatureFlag> {
  const response = await apiRequest(`/admin/feature-flags/${flagId}/toggle`, { method: "POST" });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to toggle feature flag");
  }
  return response.json();
}

export async function deleteFeatureFlag(flagId: number): Promise<void> {
  const response = await apiRequest(`/admin/feature-flags/${flagId}`, { method: "DELETE" });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to delete feature flag");
  }
}

export async function fetchPublicConfig(): Promise<PublicConfig> {
  const response = await apiRequest("/public/config");
  if (!response.ok) {
    throw new Error("Failed to load feature configuration");
  }
  return response.json();
}

// ============================================================
// Public products (catalog + detail)
// Backend dependency: a public-facing products endpoint is required.
// These functions are integration-ready and handle absence gracefully.
// ============================================================

export interface PublicProduct {
  id: number
  name: string
  slug: string
  description?: string | null
  category?: string | null
  status: string
  current_version?: string | null
  platform?: string[] | null
  tags?: string[] | null
  hero_image?: string | null
  overview?: string | null
  problem?: string | null
  solution?: string | null
  capabilities?: string[] | null
  technologies?: string[] | null
  screenshots?: string[] | null
}

export async function fetchPublicProducts(): Promise<PublicProduct[]> {
  const response = await apiRequest("/public/products")
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || "Failed to load public products")
  }
  const data = await response.json()
  return Array.isArray(data) ? data : (data?.products || [])
}

export async function fetchPublicProductBySlug(slug: string): Promise<PublicProduct> {
  const response = await apiRequest(`/public/products/${encodeURIComponent(slug)}`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || "Product not found")
  }
  return response.json()
}

// ============================================================
// Start a project (discovery intake) — integration-ready.
// Backend dependency: a dedicated start-a-project endpoint is required.
// ============================================================

export interface StartProjectPayload {
  name: string
  company?: string | null
  email: string
  phone?: string | null
  idea: string
  problem?: string | null
  expected_outcome?: string | null
  industry?: string | null
  preferred_technology?: string | null
  budget?: string | null
  timeline?: string | null
  source?: string
}

export interface StartProjectResult {
  id?: number
  reference?: string
  status: string
  message?: string
}

export async function submitStartProject(payload: StartProjectPayload): Promise<StartProjectResult> {
  const response = await apiRequest("/forms/start-project", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.detail || "Failed to submit project intake")
  }
  return response.json()
}

// ============================================================
// Public client invoice portal
// ============================================================

export interface PortalInvoice {
  id: number;
  invoice_number: string;
  title: string;
  status: string;
  issue_date: string;
  due_date?: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  amount_paid: number;
  balance: number;
  items: { item_type: string; name: string; description?: string | null; quantity: number; unit?: string | null; unit_price: number; total: number }[];
}

export interface PortalPaymentResult {
  payment_number: string;
  amount: number;
  currency: string;
  status: string;
  paid_at: string;
  invoice_number: string;
  invoice_balance: number;
  message: string;
}

export async function fetchPortalInvoice(secureReference: string): Promise<PortalInvoice> {
  const response = await apiRequest(`/public/invoices/${secureReference}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Invoice not found");
  }
  return response.json();
}

export async function payPortalInvoice(
  secureReference: string,
  data: { amount?: number; customer_name?: string; customer_email?: string; method?: string; metadata?: Record<string, unknown> }
): Promise<PortalPaymentResult> {
  const response = await apiRequest(`/public/invoices/${secureReference}/pay`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Payment failed");
  }
  return response.json();
}
// ============================================================
// Public content pages (journal, build log, collaboration).
// These endpoints are not yet implemented on the backend; they
// are integration-ready and will resolve once those routes exist.
// ============================================================

export interface JournalArticle {
  id: number;
  title: string;
  slug: string;
  category: string;
  excerpt?: string | null;
  published_at?: string | null;
  author?: string | null;
  reading_minutes?: number;
}

export async function fetchJournalArticles(): Promise<JournalArticle[]> {
  const response = await apiRequest("/cms/blog");
  if (!response.ok) {
    throw new Error("Journal API unavailable");
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data?.articles || [];
}

export interface BuildLogEntry {
  id: number;
  title: string;
  project_id?: number | null;
  entry_date?: string | null;
  description?: string | null;
  technologies?: string[];
  is_public?: boolean;
  entry_type?: string;
  author_id?: number | null;
}

export async function fetchBuildLogEntries(): Promise<BuildLogEntry[]> {
  const response = await apiRequest("/build-logs");
  if (!response.ok) {
    throw new Error("Build log API unavailable");
  }
  const data = await response.json();
  return Array.isArray(data) ? data : data?.entries || [];
}

export interface CollaborationEnquiry {
  name: string;
  email: string;
  organization?: string;
  type: string;
  message: string;
  source?: string;
}

export async function submitCollaboration(payload: CollaborationEnquiry): Promise<{ detail: string }> {
  const response = await apiRequest("/forms/collaboration", {
    method: "POST",
    body: JSON.stringify(payload),
  });
if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Collaboration API unavailable");
  }
  return response.json();
}

/* ============================================================
   Generic JSON helper for the modules below.
   ============================================================ */

async function apiJson<T>(endpoint: string, options?: RequestInit, errorMsg = "Request failed"): Promise<T> {
  const response = await apiRequest(endpoint, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    let message = errorMsg;
    if (errorData?.detail) {
      if (Array.isArray(errorData.detail)) {
        message = errorData.detail.map((e: any) => e.msg || String(e)).join(", ");
      } else {
        message = String(errorData.detail);
      }
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

/* ============================================================
   Public site config + navigation (spec §34 / §35 / §37)
   ============================================================ */

export interface PublicSiteConfig {
  theme: {
    name: string;
    is_active?: boolean;
    palette?: Record<string, unknown>;
    fonts?: Record<string, unknown>;
    ui?: Record<string, unknown>;
    layout?: Record<string, unknown>;
    appearance?: string;
  };
  settings: Record<string, string | number | boolean | null>;
}

export interface NavItem {
  id: number;
  label: string;
  url: string;
  location: string;
  display_order: number;
  is_published?: boolean;
  parent_id?: number | null;
  children?: { id: number; label: string; url: string; display_order: number }[];
}

export async function fetchPublicSite(): Promise<PublicSiteConfig> {
  return apiJson<PublicSiteConfig>("/public/site");
}

export async function fetchNavigation(): Promise<NavItem[]> {
  return apiJson<NavItem[]>("/navigation");
}

export async function fetchAdminNav(): Promise<NavItem[]> {
  return apiJson<NavItem[]>("/admin/content/navigation");
}

export async function createNavItem(data: Partial<NavItem>): Promise<NavItem> {
  return apiJson<NavItem>("/admin/content/navigation", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateNavItem(itemId: number, data: Partial<NavItem>): Promise<unknown> {
  return apiJson<unknown>(`/admin/content/navigation/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteNavItem(itemId: number): Promise<void> {
  await apiRequest(`/admin/content/navigation/${itemId}`, { method: "DELETE" });
}

/* ============================================================
   Services / Technologies / Industries (spec §36)
   ============================================================ */

export interface Service {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  category?: string | null;
  starting_price?: number | null;
  pricing_model?: string | null;
  features?: string[];
  technologies?: string[];
  image_url?: string | null;
  icon?: string | null;
  is_public?: boolean;
  is_active?: boolean;
  display_order?: number | null;
}

export interface Technology {
  id: number;
  name: string;
  slug: string;
  category?: string | null;
  logo_url?: string | null;
  description?: string | null;
  version?: string | null;
  is_public?: boolean;
  is_active?: boolean;
  display_order?: number | null;
}

export interface Industry {
  id: number;
  name: string;
  slug: string;
  description?: string | null;
  image_url?: string | null;
  problems_solved?: string[];
  related_services?: string[];
  related_technologies?: string[];
  is_public?: boolean;
  is_active?: boolean;
  display_order?: number | null;
}

export async function fetchServices(): Promise<Service[]> {
  return apiJson<Service[]>("/services");
}
export async function fetchAdminServices(): Promise<Service[]> {
  return apiJson<Service[]>("/admin/services");
}
export async function createService(data: Partial<Service>): Promise<Service> {
  return apiJson<Service>("/admin/services/", { method: "POST", body: JSON.stringify(data) });
}
export async function updateService(serviceId: number, data: Partial<Service>): Promise<Service> {
  return apiJson<Service>(`/admin/services/${serviceId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteService(serviceId: number): Promise<void> {
  await apiRequest(`/admin/services/${serviceId}`, { method: "DELETE" });
}

export async function fetchTechnologies(): Promise<Technology[]> {
  return apiJson<Technology[]>("/technologies");
}
export async function fetchAdminTechnologies(): Promise<Technology[]> {
  return apiJson<Technology[]>("/admin/technologies");
}
export async function createTechnology(data: Partial<Technology>): Promise<Technology> {
  return apiJson<Technology>("/admin/technologies/", { method: "POST", body: JSON.stringify(data) });
}
export async function updateTechnology(technologyId: number, data: Partial<Technology>): Promise<Technology> {
  return apiJson<Technology>(`/admin/technologies/${technologyId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteTechnology(technologyId: number): Promise<void> {
  await apiRequest(`/admin/technologies/${technologyId}`, { method: "DELETE" });
}

export async function fetchIndustries(): Promise<Industry[]> {
  return apiJson<Industry[]>("/industries");
}
export async function fetchAdminIndustries(): Promise<Industry[]> {
  return apiJson<Industry[]>("/admin/industries");
}
export async function createIndustry(data: Partial<Industry>): Promise<Industry> {
  return apiJson<Industry>("/admin/industries/", { method: "POST", body: JSON.stringify(data) });
}
export async function updateIndustry(industryId: number, data: Partial<Industry>): Promise<Industry> {
  return apiJson<Industry>(`/admin/industries/${industryId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteIndustry(industryId: number): Promise<void> {
  await apiRequest(`/admin/industries/${industryId}`, { method: "DELETE" });
}

/* ============================================================
   Content: FAQs / testimonials / team / partners / achievements
   (spec §34 / §66) — public reads + admin CRUD
   ============================================================ */

export interface Faq { id: number; question: string; answer: string; category?: string | null; display_order?: number | null; }
export interface Testimonial { id: number; name: string; role?: string | null; company?: string | null; content: string; rating?: number | null; image_url?: string | null; }
export interface TeamMember { id: number; name: string; position?: string | null; department?: string | null; bio?: string | null; skills?: string[]; technologies?: string[]; availability?: string | null; photo_url?: string | null; email?: string | null; }
export interface Partner { id: number; name: string; slug?: string | null; logo_url?: string | null; description?: string | null; website_url?: string | null; partner_type?: string | null; }
export interface Achievement { id: number; title: string; description?: string | null; achievement_date?: string | null; category?: string | null; metric?: string | null; image_url?: string | null; is_featured?: boolean; }

export async function fetchFaqs(): Promise<Faq[]> { return apiJson<Faq[]>("/content/faqs"); }
export async function fetchTestimonials(): Promise<Testimonial[]> { return apiJson<Testimonial[]>("/content/testimonials"); }
export async function fetchTeam(): Promise<TeamMember[]> { return apiJson<TeamMember[]>("/content/team"); }
export async function fetchPartners(): Promise<Partner[]> { return apiJson<Partner[]>("/content/partners"); }
export async function fetchAchievements(): Promise<Achievement[]> { return apiJson<Achievement[]>("/content/achievements"); }

export async function createFaq(data: Partial<Faq>): Promise<Faq> {
  return apiJson<Faq>("/admin/content/faqs", { method: "POST", body: JSON.stringify(data) });
}
export async function updateFaq(faqId: number, data: Partial<Faq>): Promise<Faq> {
  return apiJson<Faq>(`/admin/content/faqs/${faqId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteFaq(faqId: number): Promise<void> {
  await apiRequest(`/admin/content/faqs/${faqId}`, { method: "DELETE" });
}

export async function createTestimonial(data: Partial<Testimonial>): Promise<Testimonial> {
  return apiJson<Testimonial>("/admin/content/testimonials", { method: "POST", body: JSON.stringify(data) });
}
export async function updateTestimonial(testimonialId: number, data: Partial<Testimonial>): Promise<Testimonial> {
  return apiJson<Testimonial>(`/admin/content/testimonials/${testimonialId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteTestimonial(testimonialId: number): Promise<void> {
  await apiRequest(`/admin/content/testimonials/${testimonialId}`, { method: "DELETE" });
}

export async function createTeamMember(data: Partial<TeamMember>): Promise<TeamMember> {
  return apiJson<TeamMember>("/admin/content/team", { method: "POST", body: JSON.stringify(data) });
}
export async function updateTeamMember(memberId: number, data: Partial<TeamMember>): Promise<TeamMember> {
  return apiJson<TeamMember>(`/admin/content/team/${memberId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteTeamMember(memberId: number): Promise<void> {
  await apiRequest(`/admin/content/team/${memberId}`, { method: "DELETE" });
}

export async function createPartner(data: Partial<Partner>): Promise<Partner> {
  return apiJson<Partner>("/admin/content/partners", { method: "POST", body: JSON.stringify(data) });
}
export async function updatePartner(partnerId: number, data: Partial<Partner>): Promise<Partner> {
  return apiJson<Partner>(`/admin/content/partners/${partnerId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deletePartner(partnerId: number): Promise<void> {
  await apiRequest(`/admin/content/partners/${partnerId}`, { method: "DELETE" });
}

export async function createAchievement(data: Partial<Achievement>): Promise<Achievement> {
  return apiJson<Achievement>("/admin/content/achievements", { method: "POST", body: JSON.stringify(data) });
}
export async function updateAchievement(achievementId: number, data: Partial<Achievement>): Promise<Achievement> {
  return apiJson<Achievement>(`/admin/content/achievements/${achievementId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteAchievement(achievementId: number): Promise<void> {
  await apiRequest(`/admin/content/achievements/${achievementId}`, { method: "DELETE" });
}

export async function fetchContentStats(): Promise<Record<string, number>> {
  return apiJson<Record<string, number>>("/admin/content/all");
}

/* ============================================================
   Website settings + themes (admin)
   ============================================================ */

export interface WebsiteSetting {
  key: string;
  value: string | number | boolean | null;
  value_type: string;
  description?: string | null;
  is_public?: boolean;
}

export interface Theme {
  id: number;
  name: string;
  is_active: boolean;
  palette?: Record<string, unknown>;
  fonts?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  layout?: Record<string, unknown>;
  appearance?: string;
  is_preset?: boolean;
}

export async function fetchWebsiteSettings(): Promise<WebsiteSetting[]> {
  return apiJson<WebsiteSetting[]>("/admin/website/settings");
}
export async function upsertWebsiteSetting(data: {
  key: string;
  value_type: string;
  value_text?: string | null;
  value_json?: unknown;
  description?: string | null;
  is_public?: boolean;
}): Promise<WebsiteSetting> {
  const { key, ...payload } = data;
  return apiJson<WebsiteSetting>(`/admin/website/settings/${key}`, { method: "PUT", body: JSON.stringify(payload) });
}
export async function deleteWebsiteSetting(key: string): Promise<void> {
  await apiRequest(`/admin/website/settings/${key}`, { method: "DELETE" });
}

export async function fetchThemes(): Promise<Theme[]> {
  return apiJson<Theme[]>("/admin/website/themes");
}
export async function createTheme(data: Partial<Theme>): Promise<Theme> {
  return apiJson<Theme>("/admin/website/themes", { method: "POST", body: JSON.stringify(data) });
}
export async function updateTheme(themeId: number, data: Partial<Theme>): Promise<Theme> {
  return apiJson<Theme>(`/admin/website/themes/${themeId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function activateTheme(themeId: number): Promise<Theme> {
  return apiJson<Theme>(`/admin/website/themes/${themeId}/activate`, { method: "POST" });
}
export async function deleteTheme(themeId: number): Promise<void> {
  await apiRequest(`/admin/website/themes/${themeId}`, { method: "DELETE" });
}

/* ============================================================
   Public forms + newsletter + admin submissions (spec §60 / §62)
   ============================================================ */

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
}

export interface PublicSubmission {
  id: number;
  form_type: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  subject?: string | null;
  message?: string | null;
  industry?: string | null;
  preferred_technology?: string | null;
  budget?: string | null;
  timeline?: string | null;
  whatsapp?: string | null;
  created_ip?: string | null;
  converted_lead_id?: number | null;
  created_at: string;
}

export interface NewsletterSubscriber {
  id: number;
  email: string;
  name?: string | null;
  is_active: boolean;
  source?: string | null;
  subscribed_at: string;
}

export async function submitContact(payload: ContactPayload): Promise<{ id: number; form_type: string }> {
  return apiJson<{ id: number; form_type: string }>("/forms/contact", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function submitProjectSubmission(payload: StartProjectPayload): Promise<{ id: number; form_type: string }> {
  return apiJson<{ id: number; form_type: string }>("/forms/project-submission", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function subscribeNewsletter(email: string, name?: string): Promise<{ detail: string; subscribed: boolean }> {
  return apiJson<{ detail: string; subscribed: boolean }>("/newsletter", {
    method: "POST",
    body: JSON.stringify({ email, name }),
  });
}

export async function fetchSubmissions(formType?: string): Promise<PublicSubmission[]> {
  const query = formType ? `?form_type=${encodeURIComponent(formType)}` : "";
  return apiJson<PublicSubmission[]>(`/admin/submissions${query}`);
}
export async function fetchNewsletterSubscribers(): Promise<NewsletterSubscriber[]> {
  return apiJson<NewsletterSubscriber[]>("/admin/submissions/newsletter");
}
export async function convertSubmission(submissionId: number): Promise<{ detail: string; lead_id: number }> {
  return apiJson<{ detail: string; lead_id: number }>(`/admin/submissions/${submissionId}/convert`, { method: "POST" });
}

/* ============================================================
   SEO + audit
   ============================================================ */

export interface SEOSnapshot {
  base_url: string;
  counts: Record<string, number>;
  total_indexable: number;
}

export async function fetchSEOSnapshot(): Promise<SEOSnapshot> {
  return apiJson<SEOSnapshot>("/seo/snapshot");
}
export async function fetchSitemap(): Promise<string> {
  const response = await apiRequest("/seo/sitemap.xml");
  return response.ok ? response.text() : "";
}
export async function fetchRobots(): Promise<string> {
  const response = await apiRequest("/seo/robots.txt");
  return response.ok ? response.text() : "";
}

export interface AuditLog {
  id: number;
  user_id?: number | null;
  actor?: string | null;
  action: string;
  module?: string | null;
  entity_type?: string | null;
  entity_id?: number | null;
  old_value?: unknown;
  new_value?: unknown;
  request_ip?: string | null;
  request_method?: string | null;
  request_path?: string | null;
  user_agent?: string | null;
  timestamp: string;
}

export interface AuditStats {
  total: number;
  by_action: Record<string, number>;
  by_module: Record<string, number>;
}

export async function fetchAuditLogs(limit = 200, module?: string): Promise<AuditLog[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (module) params.append("module", module);
  const data = await apiJson<{ count: number; items: AuditLog[] }>(`/admin/audit?${params.toString()}`);
  return data.items;
}
export async function fetchAuditStats(): Promise<AuditStats> {
  return apiJson<AuditStats>("/admin/audit/stats");
}

/* ============================================================
   Case studies (spec §36 stories)
   ============================================================ */

export interface CaseStudy {
  id: number;
  project_id: number;
  project_title?: string | null;
  problem?: string | null;
  challenge?: string | null;
  approach?: string | null;
  solution?: string | null;
  technologies?: string[];
  results?: string | null;
  impact?: string | null;
  cover_image?: string | null;
  is_published?: boolean;
  published_at?: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
}

export async function fetchCaseStudies(): Promise<CaseStudy[]> { return apiJson<CaseStudy[]>("/case-studies"); }
export async function fetchAdminCaseStudies(): Promise<CaseStudy[]> { return apiJson<CaseStudy[]>("/admin/case-studies"); }
export async function createCaseStudy(data: Partial<CaseStudy>): Promise<CaseStudy> {
  return apiJson<CaseStudy>("/admin/case-studies/", { method: "POST", body: JSON.stringify(data) });
}
export async function updateCaseStudy(caseStudyId: number, data: Partial<CaseStudy>): Promise<CaseStudy> {
  return apiJson<CaseStudy>(`/admin/case-studies/${caseStudyId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteCaseStudy(caseStudyId: number): Promise<void> {
  await apiRequest(`/admin/case-studies/${caseStudyId}`, { method: "DELETE" });
}

/* ============================================================
   Research / Experiments / Build logs (spec §40)
   ============================================================ */

export interface Research {
  id: number;
  title: string;
  slug: string;
  category?: string | null;
  industry?: string | null;
  abstract?: string | null;
  description?: string | null;
  objectives?: string | null;
  methodology?: string | null;
  results?: string | null;
  technologies: string[];
  researchers?: string[];
  publication_links?: string[];
  related_project_ids?: number[];
  related_experiment_ids?: number[];
  related_product_ids?: number[];
  status?: string;
  start_date?: string | null;
  end_date?: string | null;
  is_public?: boolean;
  created_at?: string;
}

export interface Experiment {
  id: number;
  title: string;
  slug: string;
  objective?: string | null;
  hypothesis?: string | null;
  description?: string | null;
  components: string[];
  technologies: string[];
  procedure?: string | null;
  observations?: string | null;
  results?: string | null;
  conclusion?: string | null;
  next_step?: string | null;
  status?: string;
  is_public?: boolean;
  project_id?: number | null;
  research_ids?: number[];
  created_at?: string;
}

export async function fetchResearch(): Promise<Research[]> { return apiJson<Research[]>("/research"); }
export async function fetchResearchBySlug(slug: string): Promise<Research> {
  return apiJson<Research>(`/research/${encodeURIComponent(slug)}`, undefined, "Research not found");
}
export async function fetchAdminResearch(): Promise<Research[]> { return apiJson<Research[]>("/admin/research"); }
export async function createResearch(data: Partial<Research>): Promise<Research> {
  return apiJson<Research>("/admin/research/", { method: "POST", body: JSON.stringify(data) });
}
export async function updateResearch(researchId: number, data: Partial<Research>): Promise<Research> {
  return apiJson<Research>(`/admin/research/${researchId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteResearch(researchId: number): Promise<void> {
  await apiRequest(`/admin/research/${researchId}`, { method: "DELETE" });
}

export async function fetchExperiments(): Promise<Experiment[]> { return apiJson<Experiment[]>("/experiments"); }
export async function fetchExperimentBySlug(slug: string): Promise<Experiment> {
  return apiJson<Experiment>(`/experiments/${encodeURIComponent(slug)}`, undefined, "Experiment not found");
}
export async function fetchAdminExperiments(): Promise<Experiment[]> { return apiJson<Experiment[]>("/admin/experiments"); }
export async function createExperiment(data: Partial<Experiment>): Promise<Experiment> {
  return apiJson<Experiment>("/admin/experiments/", { method: "POST", body: JSON.stringify(data) });
}
export async function updateExperiment(experimentId: number, data: Partial<Experiment>): Promise<Experiment> {
  return apiJson<Experiment>(`/admin/experiments/${experimentId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteExperiment(experimentId: number): Promise<void> {
  await apiRequest(`/admin/experiments/${experimentId}`, { method: "DELETE" });
}

export async function fetchAdminBuildLogs(): Promise<BuildLogEntry[]> { return apiJson<BuildLogEntry[]>("/admin/build-logs"); }
export async function createBuildLog(data: Partial<BuildLogEntry>): Promise<BuildLogEntry> {
  return apiJson<BuildLogEntry>("/admin/build-logs/", { method: "POST", body: JSON.stringify(data) });
}
export async function updateBuildLog(buildLogId: number, data: Partial<BuildLogEntry>): Promise<BuildLogEntry> {
  return apiJson<BuildLogEntry>(`/admin/build-logs/${buildLogId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteBuildLog(buildLogId: number): Promise<void> {
  await apiRequest(`/admin/build-logs/${buildLogId}`, { method: "DELETE" });
}

/* ============================================================
   Inventory (spec §55)
   ============================================================ */

export interface Supplier {
  id: number;
  name: string;
  company?: string | null;
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  payment_terms?: string | null;
  status?: string;
  notes?: string | null;
}

export interface Component {
  id: number;
  sku: string;
  name: string;
  category?: string | null;
  manufacturer?: string | null;
  model_no?: string | null;
  description?: string | null;
  supplier_id?: number | null;
  purchase_price?: number;
  selling_price?: number;
  current_stock?: number;
  minimum_stock?: number;
  unit?: string;
  storage_location?: string | null;
  datasheet_url?: string | null;
  image_url?: string | null;
  notes?: string | null;
  status?: string;
  low_stock?: boolean;
}

export interface InventoryMovement {
  id: number;
  component_id: number;
  movement_type: string;
  quantity: number;
  unit_cost?: number | null;
  project_id?: number | null;
  reference_number?: string | null;
  note?: string | null;
  created_by?: number | null;
  created_at?: string;
}

export interface InventorySummary {
  components_count: number;
  total_units_in_stock: number;
  low_stock_count: number;
  inventory_value: number;
  suppliers_count: number;
}

export async function fetchInventorySummary(): Promise<InventorySummary> {
  return apiJson<InventorySummary>("/inventory/summary");
}
export async function fetchSuppliers(): Promise<Supplier[]> { return apiJson<Supplier[]>("/admin/inventory/suppliers"); }
export async function createSupplier(data: Partial<Supplier>): Promise<Supplier> {
  return apiJson<Supplier>("/admin/inventory/suppliers", { method: "POST", body: JSON.stringify(data) });
}
export async function updateSupplier(supplierId: number, data: Partial<Supplier>): Promise<Supplier> {
  return apiJson<Supplier>(`/admin/inventory/suppliers/${supplierId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteSupplier(supplierId: number): Promise<void> {
  await apiRequest(`/admin/inventory/suppliers/${supplierId}`, { method: "DELETE" });
}
export async function fetchComponents(): Promise<Component[]> { return apiJson<Component[]>("/inventory/components"); }
export async function createComponent(data: Partial<Component>): Promise<Component> {
  return apiJson<Component>("/admin/inventory/components", { method: "POST", body: JSON.stringify(data) });
}
export async function updateComponent(componentId: number, data: Partial<Component>): Promise<Component> {
  return apiJson<Component>(`/admin/inventory/components/${componentId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteComponent(componentId: number): Promise<void> {
  await apiRequest(`/admin/inventory/components/${componentId}`, { method: "DELETE" });
}
export async function createInventoryMovement(data: {
  component_id: number;
  movement_type: string;
  quantity: number;
  unit_cost?: number | null;
  project_id?: number | null;
  reference_number?: string | null;
  note?: string | null;
}): Promise<InventoryMovement & { new_stock: number }> {
  return apiJson<InventoryMovement & { new_stock: number }>("/inventory/movements", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchInventoryMovements(componentId?: number, limit = 100): Promise<InventoryMovement[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (componentId) params.append("component_id", String(componentId));
  return apiJson<InventoryMovement[]>(`/inventory/movements?${params.toString()}`);
}

/* ============================================================
   Password reset (spec §57)
   ============================================================ */

export async function forgotPassword(email: string): Promise<{ detail: string }> {
  return apiJson<{ detail: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ detail: string }> {
  return apiJson<{ detail: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

/* ============================================================
   Analytics (spec dashboards) — /analytics/*
   ============================================================ */

export interface AnalyticsDashboard {
  counts: Record<string, number>;
  revenue: { total_paid: number; invoices_outstanding: number };
  people: { users: number; contacts: number; team_members: number };
}

export interface AnalyticsFinancials {
  summary: {
    total_invoiced: number;
    total_paid: number;
    amount_due: number;
    accepted_quotations_value: number;
    project_actual_cost: number;
    project_selling_value: number;
    gross_margin: number;
  };
  invoices_by_status: Record<string, number>;
  payments_by_method: Record<string, number>;
}

export interface AnalyticsProjects {
  by_status: Record<string, number>;
  tasks_by_status: Record<string, number>;
  milestones: { total: number; completed: number };
  automation_runs: { success: number; failed: number; pending: number };
}

export interface AnalyticsComms {
  emails: { total: number; sent: number; simulated: number };
  whatsapp: { total: number; sent: number; simulated: number };
  audit_events: number;
  automation_events_pending: number;
  calendar_events: number;
}

export async function fetchAnalyticsDashboard(): Promise<AnalyticsDashboard> {
  return apiJson<AnalyticsDashboard>("/analytics/dashboard");
}
export async function fetchAnalyticsFinancials(): Promise<AnalyticsFinancials> {
  return apiJson<AnalyticsFinancials>("/analytics/financials");
}
export async function fetchAnalyticsProjects(): Promise<AnalyticsProjects> {
  return apiJson<AnalyticsProjects>("/analytics/projects");
}
export async function fetchAnalyticsComms(): Promise<AnalyticsComms> {
  return apiJson<AnalyticsComms>("/analytics/comms");
}

/* ============================================================
   Clients directory (spec §24 / §66) — /clients
   ============================================================ */

export interface Client {
  id: number;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
  status: string;
  communication_history?: Record<string, unknown>[];
  contacts_count?: number;
  projects_count?: number;
  quotations_count?: number;
  contracts_count?: number;
  invoices_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ClientDetail extends Client {
  contacts?: { id: number; first_name?: string; last_name?: string; email?: string; phone?: string }[];
  projects?: { id: number; project_number: string; title: string; status: string }[];
}

export type ClientInput = Partial<Client> & { name: string };

export async function fetchClients(search?: string, statusFilter?: string): Promise<Client[]> {
  const params = new URLSearchParams({ skip: "0", limit: "200" });
  if (search) params.append("search", search);
  if (statusFilter) params.append("status_filter", statusFilter);
  return apiJson<Client[]>(`/clients?${params.toString()}`);
}
export async function fetchClient(clientId: number): Promise<ClientDetail> {
  return apiJson<ClientDetail>(`/clients/${clientId}`);
}
export async function createClient(data: ClientInput): Promise<Client> {
  return apiJson<Client>("/clients", { method: "POST", body: JSON.stringify(data) });
}
export async function updateClient(clientId: number, data: Partial<Client>): Promise<Client> {
  return apiJson<Client>(`/clients/${clientId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteClient(clientId: number): Promise<{ detail: string }> {
  return apiJson<{ detail: string }>(`/clients/${clientId}`, { method: "DELETE" });
}
export async function fetchClientCommunications(clientId: number): Promise<Record<string, unknown>[]> {
  return apiJson<Record<string, unknown>[]>(`/clients/${clientId}/communications`);
}
export async function addClientCommunication(
  clientId: number,
  payload: { type?: string; content: string }
): Promise<Record<string, unknown>[]> {
  return apiJson<Record<string, unknown>[]>(`/clients/${clientId}/communications`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ============================================================
   Email templates + logs (spec §44) — /admin/email, /email
   ============================================================ */

export interface EmailLog {
  id: number;
  recipient: string;
  template_id?: number | null;
  subject?: string | null;
  status: string;
  provider?: string | null;
  error?: string | null;
  message_id?: string | null;
  related_entity?: string | null;
  related_id?: number | null;
  email_timestamp?: string;
}

export interface EmailTemplate {
  id: number;
  name: string;
  slug: string;
  subject: string;
  body_html?: string | null;
  body_text?: string | null;
  variables?: string[];
  is_active: boolean;
  created_at?: string;
}

export type EmailTemplateInput = Partial<EmailTemplate> & { name: string; subject: string };

export async function fetchEmailLogs(limit = 100): Promise<EmailLog[]> {
  return apiJson<EmailLog[]>(`/admin/email/logs?limit=${limit}`);
}
export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  return apiJson<EmailTemplate[]>("/admin/email/templates");
}
export async function createEmailTemplate(data: EmailTemplateInput): Promise<EmailTemplate> {
  return apiJson<EmailTemplate>("/admin/email/templates", { method: "POST", body: JSON.stringify(data) });
}
export async function updateEmailTemplate(templateId: number, data: Partial<EmailTemplate>): Promise<EmailTemplate> {
  return apiJson<EmailTemplate>(`/admin/email/templates/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
export async function deleteEmailTemplate(templateId: number): Promise<{ detail: string }> {
  return apiJson<{ detail: string }>(`/admin/email/templates/${templateId}`, { method: "DELETE" });
}

/* ============================================================
   WhatsApp templates + logs (spec §55) — /admin/whatsapp, /whatsapp
   ============================================================ */

export interface WhatsAppLog {
  id: number;
  phone: string;
  template_id?: number | null;
  status: string;
  provider?: string | null;
  error?: string | null;
  message_id?: string | null;
  wa_id?: string | null;
  related_entity?: string | null;
  related_id?: number | null;
  timestamp?: string;
}

export interface WhatsAppTemplate {
  id: number;
  name: string;
  body: string;
  variables?: string[];
  is_active: boolean;
  created_at?: string;
}

export async function fetchWhatsAppLogs(limit = 100): Promise<WhatsAppLog[]> {
  return apiJson<WhatsAppLog[]>(`/admin/whatsapp/logs?limit=${limit}`);
}
export async function fetchWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  return apiJson<WhatsAppTemplate[]>("/admin/whatsapp/templates");
}
export async function createWhatsAppTemplate(data: Partial<WhatsAppTemplate> & { name: string; body: string }): Promise<WhatsAppTemplate> {
  return apiJson<WhatsAppTemplate>("/admin/whatsapp/templates", { method: "POST", body: JSON.stringify(data) });
}
export async function updateWhatsAppTemplate(templateId: number, data: Partial<WhatsAppTemplate>): Promise<WhatsAppTemplate> {
  return apiJson<WhatsAppTemplate>(`/admin/whatsapp/templates/${templateId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
export async function deleteWhatsAppTemplate(templateId: number): Promise<{ detail: string }> {
  return apiJson<{ detail: string }>(`/admin/whatsapp/templates/${templateId}`, { method: "DELETE" });
}

/* ============================================================
   Knowledge base (spec §33) — /knowledge, /admin/knowledge
   ============================================================ */

export interface KnowledgeCategory {
  id: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  display_order?: number;
}

export interface KnowledgeArticle {
  id: number;
  title: string;
  slug: string;
  category_id?: number | null;
  category?: KnowledgeCategory | null;
  content?: string | null;
  tags?: string[];
  related_project_id?: number | null;
  related_technology?: string | null;
  visibility: string;
  version: string;
  is_published: boolean;
  author_id?: number | null;
  created_at?: string;
}

export type KnowledgeArticleInput = Partial<KnowledgeArticle> & { title: string };

export async function fetchKnowledgePublic(): Promise<(KnowledgeCategory & { articles: KnowledgeArticle[] })[]> {
  return apiJson<(KnowledgeCategory & { articles: KnowledgeArticle[] })[]>("/knowledge/public");
}
export async function fetchKnowledgeCategories(): Promise<KnowledgeCategory[]> {
  return apiJson<KnowledgeCategory[]>("/knowledge/categories");
}
export async function createKnowledgeCategory(data: Partial<KnowledgeCategory> & { name: string }): Promise<KnowledgeCategory> {
  return apiJson<KnowledgeCategory>("/admin/knowledge/categories", { method: "POST", body: JSON.stringify(data) });
}
export async function updateKnowledgeCategory(categoryId: number, data: Partial<KnowledgeCategory>): Promise<KnowledgeCategory> {
  return apiJson<KnowledgeCategory>(`/admin/knowledge/categories/${categoryId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
export async function deleteKnowledgeCategory(categoryId: number): Promise<{ detail: string }> {
  return apiJson<{ detail: string }>(`/admin/knowledge/categories/${categoryId}`, { method: "DELETE" });
}
export async function fetchKnowledgeArticles(categoryId?: number, search?: string): Promise<KnowledgeArticle[]> {
  const params = new URLSearchParams();
  if (categoryId) params.append("category_id", String(categoryId));
  if (search) params.append("search", search);
  const qs = params.toString();
  return apiJson<KnowledgeArticle[]>(`/knowledge/articles${qs ? `?${qs}` : ""}`);
}
export async function fetchKnowledgeArticle(articleId: number): Promise<KnowledgeArticle> {
  return apiJson<KnowledgeArticle>(`/knowledge/articles/${articleId}`);
}
export async function createKnowledgeArticle(data: KnowledgeArticleInput): Promise<KnowledgeArticle> {
  return apiJson<KnowledgeArticle>("/admin/knowledge/articles", { method: "POST", body: JSON.stringify(data) });
}
export async function updateKnowledgeArticle(articleId: number, data: Partial<KnowledgeArticle>): Promise<KnowledgeArticle> {
  return apiJson<KnowledgeArticle>(`/admin/knowledge/articles/${articleId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
export async function deleteKnowledgeArticle(articleId: number): Promise<{ detail: string }> {
  return apiJson<{ detail: string }>(`/admin/knowledge/articles/${articleId}`, { method: "DELETE" });
}

/* ============================================================
   Team / staff directory (spec §63) — /admin/users
   ============================================================ */

export interface AdminUser {
  id: number;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  is_active: boolean;
  is_verified: boolean;
  roles: string[];
  created_at?: string;
}

export interface RoleInfo {
  id: number;
  name: string;
  description?: string | null;
  permissions: string[];
}

export interface PermissionInfo {
  id: number;
  name: string;
  resource: string;
  action: string;
  description?: string | null;
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  return apiJson<AdminUser[]>("/admin/users");
}
export async function createAdminUser(data: {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  roles?: string[];
}): Promise<AdminUser> {
  return apiJson<AdminUser>("/admin/users", { method: "POST", body: JSON.stringify(data) });
}
export async function updateAdminUser(userId: number, data: Partial<AdminUser>): Promise<AdminUser> {
  return apiJson<AdminUser>(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function fetchRoles(): Promise<RoleInfo[]> {
  return apiJson<RoleInfo[]>("/admin/users/roles/all");
}
export async function createRole(data: Partial<RoleInfo> & { name: string }): Promise<RoleInfo> {
  return apiJson<RoleInfo>("/admin/users/roles", { method: "POST", body: JSON.stringify(data) });
}
export async function updateRole(roleId: number, data: Partial<RoleInfo>): Promise<RoleInfo> {
  return apiJson<RoleInfo>(`/admin/users/roles/${roleId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteRole(roleId: number): Promise<void> {
  await apiRequest(`/admin/users/roles/${roleId}`, { method: "DELETE" });
}
export async function fetchPermissions(): Promise<PermissionInfo[]> {
  return apiJson<PermissionInfo[]>("/admin/users/permissions");
}

/* ============================================================
   Command-center global search — /command-center/search
   ============================================================ */

export interface GlobalSearchResult {
  query: string;
  count: number;
  results: {
    type: string;
    label: string;
    sub: string;
    link: string;
    id: number;
  }[];
}

export async function globalSearch(q: string, limit = 8): Promise<GlobalSearchResult> {
  return apiJson<GlobalSearchResult>(`/command-center/search?q=${encodeURIComponent(q)}&limit=${limit}`);
}

/* ============================================================
   CMS content manager — /admin/cms
   ============================================================ */

export interface CmsSection {
  id: number;
  section_key: string;
  title?: string | null;
  subtitle?: string | null;
  content?: string | null;
  cta_text?: string | null;
  cta_url?: string | null;
  image_url?: string | null;
  background?: string | null;
  display_order?: number | null;
  is_enabled: boolean;
  visibility: string;
}

export interface CmsPage {
  id: number;
  title: string;
  slug?: string | null;
  content?: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
  meta_keywords?: string | null;
  canonical_url?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  robots?: string | null;
  is_published: boolean;
  is_homepage: boolean;
  published_at?: string | null;
  display_order?: number | null;
  created_at?: string;
  updated_at?: string;
  sections: CmsSection[];
}

export interface CmsBlogPost {
  id: number;
  title: string;
  slug?: string | null;
  excerpt?: string | null;
  content?: string | null;
  category?: string | null;
  tags: string[];
  cover_image?: string | null;
  is_published: boolean;
  is_featured: boolean;
  published_at?: string | null;
  author?: string | null;
  seo_title?: string | null;
  meta_description?: string | null;
  related_project_id?: number | null;
  related_research_id?: number | null;
}

export interface CmsPagePayload {
  title: string;
  slug?: string;
  content?: string;
  seo_title?: string;
  meta_description?: string;
  meta_keywords?: string;
  canonical_url?: string;
  is_published?: boolean;
  is_homepage?: boolean;
  display_order?: number;
}

export interface CmsSectionPayload {
  section_key: string;
  title?: string;
  subtitle?: string;
  content?: string;
  cta_text?: string;
  cta_url?: string;
  image_url?: string;
  background?: string;
  display_order?: number;
  is_enabled?: boolean;
  visibility?: string;
}

export interface CmsBlogPayload {
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  category?: string;
  tags?: string[];
  cover_image?: string;
  is_published?: boolean;
  is_featured?: boolean;
  seo_title?: string;
  meta_description?: string;
  related_project_id?: number;
  related_research_id?: number;
}

export async function fetchAdminPages(): Promise<CmsPage[]> {
  return apiJson<CmsPage[]>("/admin/cms/pages");
}
export async function createCmsPage(data: CmsPagePayload): Promise<CmsPage> {
  return apiJson<CmsPage>("/admin/cms/pages", { method: "POST", body: JSON.stringify(data) });
}
export async function updateCmsPage(pageId: number, data: Partial<CmsPagePayload>): Promise<CmsPage> {
  return apiJson<CmsPage>(`/admin/cms/pages/${pageId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteCmsPage(pageId: number): Promise<{ detail: string }> {
  return apiJson<{ detail: string }>(`/admin/cms/pages/${pageId}`, { method: "DELETE" });
}
export async function createCmsSection(pageId: number, data: CmsSectionPayload): Promise<CmsPage> {
  return apiJson<CmsPage>(`/admin/cms/pages/${pageId}/sections`, { method: "POST", body: JSON.stringify(data) });
}
export async function updateCmsSection(sectionId: number, data: Partial<CmsSectionPayload>): Promise<CmsPage> {
  return apiJson<CmsPage>(`/admin/cms/sections/${sectionId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteCmsSection(sectionId: number): Promise<{ detail: string }> {
  return apiJson<{ detail: string }>(`/admin/cms/sections/${sectionId}`, { method: "DELETE" });
}
export async function fetchAdminBlog(): Promise<CmsBlogPost[]> {
  return apiJson<CmsBlogPost[]>("/admin/cms/blog");
}
export async function createCmsBlog(data: CmsBlogPayload): Promise<CmsBlogPost> {
  return apiJson<CmsBlogPost>("/admin/cms/blog", { method: "POST", body: JSON.stringify(data) });
}
export async function updateCmsBlog(postId: number, data: Partial<CmsBlogPayload>): Promise<CmsBlogPost> {
  return apiJson<CmsBlogPost>(`/admin/cms/blog/${postId}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function deleteCmsBlog(postId: number): Promise<{ detail: string }> {
  return apiJson<{ detail: string }>(`/admin/cms/blog/${postId}`, { method: "DELETE" });
}

/* ============================================================
   Public site data — blog + portfolio
   ============================================================ */

export async function fetchPublicBlog(category?: string, limit = 50): Promise<CmsBlogPost[]> {
  const q = new URLSearchParams()
  if (category) q.set("category", category)
  q.set("limit", String(limit))
  return apiJson<CmsBlogPost[]>(`/cms/blog?${q.toString()}`);
}
export async function fetchPublicBlogPost(slug: string): Promise<CmsBlogPost> {
  return apiJson<CmsBlogPost>(`/cms/blog/${encodeURIComponent(slug)}`, undefined, "Post not found");
}

export interface PublicProject {
  project_number: string;
  title: string;
  acronym?: string | null;
  description?: string | null;
  status: string;
  start_date?: string | null;
  target_end_date?: string | null;
  actual_end_date?: string | null;
}

export interface PublicProjectListResult {
  projects: PublicProject[];
  total: number;
}

export async function fetchPublicProjects(params?: {
  search?: string;
  status_filter?: string;
  sort_by?: string;
  order?: string;
  skip?: number;
  limit?: number;
}): Promise<PublicProjectListResult> {
  const q = new URLSearchParams()
  if (params?.search) q.set("search", params.search)
  if (params?.status_filter) q.set("status_filter", params.status_filter)
  if (params?.sort_by) q.set("sort_by", params.sort_by)
  if (params?.order) q.set("order", params.order)
  if (params?.skip) q.set("skip", String(params.skip))
  q.set("limit", String(params?.limit ?? 20))
  return apiJson<PublicProjectListResult>(`/public/projects/?${q.toString()}`);
}
