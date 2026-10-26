import apiClient from "./apiClient";

// Bridged to the PANEL auth endpoints (/api/v1/admin/*) — this section runs
// inside the restocare admin panel and reuses its session (rc.* localStorage
// keys) instead of the reference app's own /auth flow.
export const authApi = {
  login: async (
    email: string,
    password: string
  ) => {
    const response = await apiClient.post(
      "/api/v1/admin/login",
      {
        email,
        password,
      }
    );

    return response.data;
  },

  logout: async () => {
    const sessionId =
      typeof window !== "undefined"
        ? window.localStorage.getItem("rc.sessionId")
        : null;
    const response = await apiClient.post("/api/v1/admin/logout", {
      sessionId,
    });

    return response.data;
  },

  sendSetPassword: async (
    email: string
  ) => {
    const response = await apiClient.post(
      "/api/v1/auth/send-set-password",
      { email }
    );

    return response.data;
  },

  validateToken: async (
    token: string
  ) => {
    const response = await apiClient.get(
      `/api/v1/auth/validate-token?token=${encodeURIComponent(token)}`
    );

    return response.data;
  },

  setPassword: async (
    token: string,
    password: string
  ) => {
    const response = await apiClient.post(
      "/api/v1/auth/set-password",
      {
        token,
        password,
      }
    );

    return response.data;
  },

  // Panel profile mapped into the reference User shape ({ id, email, tenantId,
  // roles, permissions }) so usePermissions/PermissionGate work unchanged.
  // Panel admins hold "*" permissions → normalized to the super_admin role;
  // tenant users surface their tenantId + tenant role so /real-estate scopes to
  // their tenant. tenantId/roleNames come from the panel session (rc.* keys the
  // login wrote) — /api/v1/admin/me is admin-guarded and may reject a tenant
  // user, so we read those from storage and treat the /me call as best-effort.
  getMe: async () => {
    const read = <T,>(key: string, fallback: T): T => {
      try {
        return JSON.parse(window.localStorage.getItem(key) ?? "null") ?? fallback;
      } catch {
        return fallback;
      }
    };
    const stored = read<{
      id?: number;
      email?: string | null;
      name?: string | null;
      role?: string;
      tenantId?: string | null;
    } | null>("rc.user", null);
    const permissions = read<string[]>("rc.permissions", []);
    const roleNames = read<string[]>("rc.roleNames", []);

    let admin = stored;
    try {
      const response = await apiClient.get("/api/v1/admin/me");
      admin = { ...stored, ...(response.data as object) };
    } catch {
      // Admin-guarded endpoint refuses tenant users — fall back to the stored
      // panel profile written at login.
    }

    const roles =
      admin?.role === "SUPER_ADMIN" || permissions.includes("*")
        ? ["super_admin"]
        : roleNames.length
          ? roleNames
          : [String(admin?.role ?? "").toLowerCase()];

    return {
      id: String(admin?.id ?? ""),
      email: admin?.email ?? "",
      name: admin?.name ?? "",
      tenantId: admin?.tenantId ?? stored?.tenantId ?? null,
      roles,
      permissions,
    };
  },

  changePassword: async (newPassword: string) => {
    const response = await apiClient.post("/api/v1/admin/change-password", {
      newPassword,
    });
    return response.data;
  },
};

/** Tenant (client) as the API returns it; older rows still use snake_case keys. */
export interface ApiClientRecord {
  id?: string;
  _id?: string;
  name?: string;
  clientName?: string;
  client_name?: string;
  companyName?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  company_size?: string;
  monthlyBudget?: string;
  monthly_budget?: string;
  notes?: string;
  additional_notes?: string;
  createdAt?: string;
  created_at?: string;
  services?: unknown[];
  servicesNeeded?: unknown[];
  isBlocked?: boolean;
  [key: string]: unknown;
}

/** Body of POST /api/tenants and PUT /api/tenants/:id. */
export interface ClientPayload {
  name: string;
  clientName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  website?: string;
  industry?: string;
  companySize?: string;
  monthlyBudget?: string;
  notes?: string;
  servicesNeeded?: string[];
}

export const clientApi = {
  createClient: async (
    payload: ClientPayload
  ) => {
    const response = await apiClient.post(
      "/api/tenants",
      payload
    );

    return response.data;
  },

  getClients: async (): Promise<ApiClientRecord[]> => {
    const response = await apiClient.get(
      "/api/tenants"
    );

    return response.data;
  },

  getClient: async (
    id: string
  ) => {
    const response = await apiClient.get(
      `/api/tenants/${id}`
    );

    return response.data;
  },

  updateClient: async (
    id: string,
    payload: ClientPayload
  ) => {
    const response = await apiClient.put(
      `/api/tenants/${id}`,
      payload
    );

    return response.data;
  },

  deleteClient: async (
    id: string
  ) => {
    const response = await apiClient.delete(
      `/api/tenants/${id}`
    );

    return response.data;
  },

  toggleBlock: async (id: string) => {
    const response = await apiClient.patch(
      `/api/tenants/${id}/toggle-block`
    );

    return response.data;
  },
};

// Self-service actions for the currently authenticated tenant.
// Mounted at /account (not /tenants) so tenant admins aren't blocked by the
// super-admin-only /tenants guard in the request interceptor.
export const accountApi = {
  // Permanently delete the caller's OWN tenant account and all related data.
  deleteMyAccount: async (confirmEmail?: string) => {
    const response = await apiClient.delete("/api/account", {
      data: { confirm: true, ...(confirmEmail ? { confirmEmail } : {}) },
    });

    return response.data;
  },
};

export interface ApiRole {
  id: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  tenantId?: string | null;
  [key: string]: unknown;
}

/**
 * One entry of a user's `roles`. Login returns bare names, getMe returns
 * role objects, and the user list returns join rows wrapping the role.
 */
export type UserRoleRef = string | (Partial<ApiRole> & { role?: Partial<ApiRole> });

export interface ApiUser {
  id: string;
  name?: string;
  email: string;
  phoneNumber?: string;
  phone?: string;
  status?: string;
  isPasswordSet?: boolean;
  tenantId?: string | null;
  roles?: UserRoleRef[];
  [key: string]: unknown;
}

/** Body of POST /api/users. */
export interface CreateUserPayload {
  name: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  tenantId?: string | null;
  roleId: string;
}

/** Body of PATCH /api/users/:id. */
export type UpdateUserPayload = Partial<Pick<ApiUser, "name" | "email" | "phoneNumber">>;

export const userApi = {
  createUser: async (payload: CreateUserPayload) => {
    const response = await apiClient.post("/api/users", payload);
    return response.data;
  },

  getUsers: async (tenantId?: string | null): Promise<ApiUser[]> => {
    const url = tenantId ? `/api/users?tenantId=${tenantId}` : "/api/users";
    const response = await apiClient.get(url);
    return response.data;
  },

  getRoles: async (): Promise<ApiRole[]> => {
    const response = await apiClient.get("/api/roles");
    return response.data;
  },

  updateUser: async (id: string, payload: UpdateUserPayload) => {
    const response = await apiClient.patch(`/api/users/${id}`, payload);
    return response.data;
  },

  syncUserRoles: async (id: string, roleIds: string[]) => {
    const response = await apiClient.put(`/api/users/${id}/roles`, { roleIds });
    return response.data;
  },

  deleteUser: async (id: string) => {
    const response = await apiClient.delete(`/api/users/${id}`);
    return response.data;
  },

  updateAiMode: async (id: string, aiMode: boolean) => {
    const response = await apiClient.patch(`/api/users/${id}/ai-mode`, { ai_mode: aiMode });
    return response.data;
  },
};

// ─── RBAC: Roles ──────────────────────────────────────────────────────────────

export const rolesApi = {
  getRoles: async (params?: { tenantId?: string; system?: boolean }) => {
    const response = await apiClient.get("/api/roles", { params });
    return response.data;
  },

  getRole: async (id: string) => {
    const response = await apiClient.get(`/api/roles/${id}`);
    return response.data;
  },

  createRole: async (payload: {
    name: string;
    description?: string;
    tenantId?: string;
  }) => {
    const response = await apiClient.post("/api/roles", payload);
    return response.data;
  },

  updateRole: async (
    id: string,
    payload: { name?: string; description?: string }
  ) => {
    const response = await apiClient.patch(`/api/roles/${id}`, payload);
    return response.data;
  },

  deleteRole: async (id: string) => {
    const response = await apiClient.delete(`/api/roles/${id}`);
    return response.data;
  },

  syncPermissions: async (id: string, permissionIds: string[]) => {
    const response = await apiClient.put(`/api/roles/${id}/permissions`, {
      permissionIds,
    });
    return response.data;
  },

  addPermissions: async (id: string, permissionIds: string[]) => {
    const response = await apiClient.post(`/api/roles/${id}/permissions`, {
      permissionIds,
    });
    return response.data;
  },

  removePermission: async (id: string, permissionId: string) => {
    const response = await apiClient.delete(
      `/api/roles/${id}/permissions/${permissionId}`
    );
    return response.data;
  },

  // Reset a system role's permissions back to the config defaults.
  restoreDefaults: async (id: string) => {
    const response = await apiClient.post(
      `/api/roles/${id}/restore-defaults`
    );
    return response.data;
  },
};

// ─── RBAC: Permissions ────────────────────────────────────────────────────────

export const permissionsApi = {
  getPermissions: async () => {
    const response = await apiClient.get("/api/permissions");
    return response.data;
  },

  getGrouped: async () => {
    const response = await apiClient.get("/api/permissions/grouped");
    return response.data;
  },

  createPermission: async (payload: { module: string; action: string }) => {
    const response = await apiClient.post("/api/permissions", payload);
    return response.data;
  },

  deletePermission: async (id: string) => {
    const response = await apiClient.delete(`/api/permissions/${id}`);
    return response.data;
  },
};

// ─── RBAC: Users (typed helpers used by the role-management screens) ───────────

export const usersApi = {
  getUsers: async (params?: { tenantId?: string }) => {
    const response = await apiClient.get("/api/users", { params });
    return response.data;
  },

  getUser: async (id: string) => {
    const response = await apiClient.get(`/api/users/${id}`);
    return response.data;
  },

  createUser: async (payload: {
    email: string;
    tenantId?: string;
    roleId?: string;
  }) => {
    const response = await apiClient.post("/api/users", payload);
    return response.data;
  },

  deleteUser: async (id: string) => {
    const response = await apiClient.delete(`/api/users/${id}`);
    return response.data;
  },

  getUserPermissions: async (id: string) => {
    const response = await apiClient.get(`/api/users/${id}/permissions`);
    return response.data;
  },

  assignRole: async (id: string, roleId: string) => {
    const response = await apiClient.post(`/api/users/${id}/roles`, {
      roleId,
    });
    return response.data;
  },

  syncRoles: async (id: string, roleIds: string[]) => {
    const response = await apiClient.put(`/api/users/${id}/roles`, {
      roleIds,
    });
    return response.data;
  },

  removeRole: async (id: string, roleId: string) => {
    const response = await apiClient.delete(
      `/api/users/${id}/roles/${roleId}`
    );
    return response.data;
  },
};

// ─── Audit Logs (super admin only) ────────────────────────────────────────────

export interface AuditLogQuery {
  category?: "USER_ACTIVITY" | "LOGIN" | "SYSTEM";
  level?: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  status?: string;
  userId?: string;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const auditLogsApi = {
  getLogs: async (params?: AuditLogQuery) => {
    const response = await apiClient.get("/api/audit-logs", { params });
    return response.data;
  },

  getStats: async () => {
    const response = await apiClient.get("/api/audit-logs/stats");
    return response.data;
  },

  getLog: async (id: string) => {
    const response = await apiClient.get(`/api/audit-logs/${id}`);
    return response.data;
  },
};

// ─── Projects ─────────────────────────────────────────────────────────────────

/**
 * Project as the API returns it. Newer rows are camelCase; older ones still
 * snake_case, so readers check both (see normalizeProject).
 */
export interface ApiProject {
  id: string;
  tenantId?: string;
  projectName?: string;
  project_name?: string;
  description?: string;
  address?: string;
  landmark?: string;
  pincode?: string;
  city?: string;
  state?: string;
  builders?: Array<string | { name?: string }>;
  builderName?: string;
  builder_name?: string;
  circleRate?: number;
  slug?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  projectStatus?: string;
  project_status?: string;
  projectSubType?: string;
  project_sub_type?: string;
  projectLandArea?: string;
  project_land_area?: string;
  projectLandUnit?: string;
  startDate?: string;
  start_date?: string;
  endDate?: string;
  end_date?: string;
  possessionDate?: string;
  possession_date?: string;
  facings?: string[];
  facing?: string[];
  basicAmenities?: string[];
  basic_amenities?: string[];
  featuredAmenities?: string[];
  featured_amenities?: string[];
  isFeatured?: boolean;
  imageUrls?: string[];
  image_urls?: string[];
  videoLinks?: string[];
  video_links?: string[];
  brochureUrl?: string;
  brochure_url?: string;
  documents?: Array<{ id: string; name: string; url: string; fileName: string }>;
  [key: string]: unknown;
}

/** Fields accepted by POST /api/projects and PATCH /api/projects/:id. */
export type ProjectPayload = Partial<ApiProject>;

export const projectApi = {
  getProjects: async (): Promise<ApiProject[] | { data: ApiProject[] }> => {
    const response = await apiClient.get("/api/projects");
    return response.data;
  },

  getProject: async (id: string): Promise<ApiProject> => {
    const response = await apiClient.get(`/api/projects/${id}`);
    return response.data;
  },

  createProject: async (payload: ProjectPayload) => {
    const response = await apiClient.post("/api/projects", payload);
    return response.data;
  },

  updateProject: async (id: string, payload: ProjectPayload) => {
    const response = await apiClient.patch(`/api/projects/${id}`, payload);
    return response.data;
  },

  updateProjectImages: async (id: string, payload: FormData) => {
    const response = await apiClient.patch(`/api/projects/${id}/images`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  updateProjectBrochure: async (id: string, payload: FormData) => {
    const response = await apiClient.patch(`/api/projects/${id}/brochure`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  updateProjectDocuments: async (id: string, payload: FormData) => {
    const response = await apiClient.patch(`/api/projects/${id}/documents`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  deleteProject: async (id: string) => {
    const response = await apiClient.delete(`/api/projects/${id}`);
    return response.data;
  },

  createListing: async (id: string, payload: FormData) => {
    const response = await apiClient.post(`/api/projects/${id}/listing`, payload, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  getProjectPreview: async (slug: string) => {
    const response = await apiClient.get(`/api/projects/preview/${slug}`);
    return response.data;
  },
};

// ─── Properties ───────────────────────────────────────────────────────────────

export const propertiesApi = {
  getProperties: async (projectId: string, page?: number, limit?: number) => {
    const params = new URLSearchParams();
    params.append("projectId", projectId);
    if (page) params.append("page", String(page));
    if (limit) params.append("limit", String(limit));
    const response = await apiClient.get(`/api/properties?${params.toString()}`);
    return response.data;
  },

  uploadInventory: async (file: File, projectId: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", projectId);
    const response = await apiClient.post("/api/properties/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
};

// ─── Vector DB ────────────────────────────────────────────────────────────────

// ─── Reports ──────────────────────────────────────────────────────────────────

export const reportsApi = {
  getLeads: async () => {
    const response = await apiClient.get("/api/reports/leads");
    return response.data;
  },

  getConversions: async () => {
    const response = await apiClient.get("/api/reports/conversions");
    return response.data;
  },
};


export const vectorDbApi = {
  uploadExcel: async (file: File, namespace: string, projectId: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("namespace", namespace);
    formData.append("projectId", projectId);
    const response = await apiClient.post("/api/vector-upload", formData, {
      headers: { "Content-Type": undefined },
    });
    return response.data;
  },

  getNamespaces: async (): Promise<string[]> => {
    const response = await apiClient.get("/api/vector-upload/namespaces");
    return response.data;
  },

  createNamespace: async (namespace: string): Promise<void> => {
    await apiClient.post("/api/vector-upload/namespaces", { namespace });
  },

  addEntry: async (payload: { projectId: string; namespace: string; name: string; data: string }) => {
    const response = await apiClient.post("/api/vector-db/entries", payload);
    return response.data;
  },
};