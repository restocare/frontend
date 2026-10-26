/**
 * Notifications and RBAC (roles, permissions).
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient } from "./apiClient";

/* ------------------------------- RBAC ---------------------------------- */

export interface RbacRoleRow {
  roleId: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  /** Shipped with the product rather than created here — hidden by default. */
  isSeeded?: boolean;
  userCount?: number;
  permissions: string[];
  createdAt: string;
}

export interface PermissionCatalogEntry {
  module: string;
  actions: string[];
  keys: string[];
}

export interface StaffRow {
  userId: number;
  name: string | null;
  email: string | null;
  mobile: string | null;
  createdAt: string;
  roles: { roleId: number; name: string }[];
  employee: {
    employeeId: number;
    employeeCode: string;
    designation: string | null;
  } | null;
}

export type NotificationCategory =
  "POLICY" | "ATTENDANCE" | "SHIFT" | "LEAVE" | "GENERAL";

export interface NotificationRow {
  notificationId: number;
  category: NotificationCategory;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/** The bell. Every route is scoped to the signed-in user's own feed. */
export const notificationsApi = {
  list: (limit = 30) =>
    apiClient.get<{ notifications: NotificationRow[]; unreadCount: number }>(
      `/v1/notifications?limit=${limit}`,
    ),
  unreadCount: () =>
    apiClient.get<{ unreadCount: number }>("/v1/notifications/unread-count"),
  markRead: (id: number) =>
    apiClient.patch<NotificationRow>(`/v1/notifications/${id}/read`, {}),
  markAllRead: () =>
    apiClient.patch<{ message: string; count: number }>(
      "/v1/notifications/read-all",
      {},
    ),
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/notifications/${id}`),
};

export const rbacApi = {
  permissionCatalog: () =>
    apiClient.get<PermissionCatalogEntry[]>("/v1/rbac/permissions"),
  myPermissions: () => apiClient.get<string[]>("/v1/rbac/me/permissions"),
  roles: () => apiClient.get<RbacRoleRow[]>("/v1/rbac/roles"),
  createRole: (body: {
    name: string;
    description?: string;
    permissions?: string[];
  }) => apiClient.post<RbacRoleRow>("/v1/rbac/roles", body),
  updateRole: (
    id: number,
    body: { name?: string; description?: string; permissions?: string[] },
  ) => apiClient.patch<RbacRoleRow>(`/v1/rbac/roles/${id}`, body),
  deleteRole: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/rbac/roles/${id}`),
  staff: () => apiClient.get<StaffRow[]>("/v1/rbac/staff"),
  createStaff: (body: {
    name: string;
    email: string;
    mobile?: string;
    password: string;
    roleIds?: number[];
  }) =>
    apiClient.post<{ userId: number; message: string }>("/v1/rbac/staff", body),
  updateStaff: (
    userId: number,
    body: {
      name?: string;
      mobile?: string;
      password?: string;
      roleIds?: number[];
    },
  ) => apiClient.patch<{ message: string }>(`/v1/rbac/staff/${userId}`, body),
  deleteStaff: (userId: number) =>
    apiClient.delete<{ message: string }>(`/v1/rbac/staff/${userId}`),
};
