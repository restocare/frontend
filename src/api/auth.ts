/**
 * Admin panel session: login, me, password reset.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient, API_BASE_URL } from "./apiClient";

export type Role =
  "USER" | "SERVICE_PROFESSIONAL" | "ADMIN" | "SUPER_ADMIN" | "STAFF";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AdminUser {
  id: number;
  email: string | null;
  mobile: string | null;
  name: string;
  role: Role;
  // Present for multi-tenant SaaS (tenant) users — scopes them to the
  // /real-estate section. Null/absent for platform admins and staff.
  tenantId?: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpireTime: number;
  sessionId: string;
  user: AdminUser;
  /** CRM permissions: "*" for admins, "module.action" list for STAFF. */
  permissions?: string[];
  /** RBAC role names a STAFF member holds (e.g. ["marketing"]); [] for admins. */
  roleNames?: string[];
}

export const authApi = {
  /** POST /v1/admin/login — email + password, ADMIN / SUPER_ADMIN only. */
  login: (body: LoginRequest) =>
    apiClient.post<LoginResponse>("/v1/admin/login", body, { skipAuth: true }),

  /** POST /v1/admin/logout — destroys the current session. */
  logout: (sessionId: string) =>
    apiClient.post<{ message: string }>("/v1/admin/logout", { sessionId }),

  /** GET /v1/admin/me — the authenticated admin profile. */
  me: () => apiClient.get<AdminUser>("/v1/admin/me"),

  /** POST /v1/admin/change-password — reset the signed-in admin's password. */
  changePassword: (body: { newPassword: string }) =>
    apiClient.post<{ message: string }>("/v1/admin/change-password", body),
};

/** URL the "Continue with Google" button redirects to, to start OAuth. */
export const GOOGLE_AUTH_URL =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_URL ?? `${API_BASE_URL}/v1/auth/google`;
