/**
 * Workspaces (tenants) and their members, roles and catalog.
 *
 * Split out of the former single api.ts; import from "@/src/api/api" as before.
 */

import { apiClient } from "./apiClient";

/* ------------------------------- Workspaces ------------------------------- */
// A workspace is a self-contained mini-panel: its owner defines their own roles
// (from a workspace-only catalog) and adds members who can log in and work.

export interface WorkspaceRow {
  workspaceId: number;
  name: string;
  description: string | null;
  isActive: boolean;
  owner: { userId: number; name: string | null; email: string | null };
  isOwner: boolean;
  memberCount: number;
  roleCount: number;
  taskCount: number;
  createdAt: string;
}

export interface WorkspaceDetail extends Omit<WorkspaceRow, "isOwner"> {
  isOwner: boolean;
  /** What the CURRENT user may do in this workspace. */
  myPermissions: string[];
}

export interface WorkspaceRoleRow {
  workspaceRoleId: number;
  name: string;
  description: string | null;
  permissions: string[];
  memberCount: number;
  createdAt: string;
}

export interface WorkspaceMemberRow {
  memberId: number;
  userId: number;
  name: string;
  email: string | null;
  mobile: string | null;
  role: { workspaceRoleId: number; name: string; permissions: string[] } | null;
  isActive: boolean;
  invitedBy: { memberId: number; name: string } | null;
  juniorCount: number;
  taskCount: number;
  joinedAt: string;
}

export interface WorkspaceCatalogEntry {
  module: string;
  actions: string[];
  keys: string[];
}

/** A panel login that can be handed a workspace (for the owner picker). */
export interface EligibleOwner {
  userId: number;
  name: string;
  email: string | null;
  mobile: string | null;
  role: string;
  ownedWorkspaces: number;
}

export const workspacesApi = {
  /** The permission catalog a workspace builds its roles from. */
  catalog: () =>
    apiClient.get<WorkspaceCatalogEntry[]>("/v1/workspaces/catalog"),
  /** Panel users who may be made a workspace admin. */
  eligibleOwners: (search?: string) =>
    apiClient.get<EligibleOwner[]>(
      `/v1/workspaces/eligible-owners${search ? `?search=${encodeURIComponent(search)}` : ""}`,
    ),
  /** Workspaces I own or belong to (super admin sees all). */
  list: () => apiClient.get<WorkspaceRow[]>("/v1/workspaces"),
  get: (id: number) => apiClient.get<WorkspaceDetail>(`/v1/workspaces/${id}`),
  /** Needs workspaces.manage — hands a workspace to a panel user. */
  create: (body: { name: string; description?: string; ownerId: number }) =>
    apiClient.post<{ workspaceId: number; message: string }>(
      "/v1/workspaces",
      body,
    ),
  update: (
    id: number,
    body: { name?: string; description?: string; isActive?: boolean },
  ) => apiClient.patch<{ message: string }>(`/v1/workspaces/${id}`, body),
  remove: (id: number) =>
    apiClient.delete<{ message: string }>(`/v1/workspaces/${id}`),

  roles: (id: number) =>
    apiClient.get<WorkspaceRoleRow[]>(`/v1/workspaces/${id}/roles`),
  createRole: (
    id: number,
    body: { name: string; description?: string; permissions?: string[] },
  ) =>
    apiClient.post<{ workspaceRoleId: number; message: string }>(
      `/v1/workspaces/${id}/roles`,
      body,
    ),
  updateRole: (
    id: number,
    roleId: number,
    body: { name?: string; description?: string; permissions?: string[] },
  ) =>
    apiClient.patch<{ message: string }>(
      `/v1/workspaces/${id}/roles/${roleId}`,
      body,
    ),
  removeRole: (id: number, roleId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/workspaces/${id}/roles/${roleId}`,
    ),

  members: (id: number) =>
    apiClient.get<WorkspaceMemberRow[]>(`/v1/workspaces/${id}/members`),
  inviteMember: (
    id: number,
    body: {
      email: string;
      name: string;
      mobile?: string;
      password?: string;
      workspaceRoleId?: number;
    },
  ) =>
    apiClient.post<{ memberId: number; userId: number; message: string }>(
      `/v1/workspaces/${id}/members`,
      body,
    ),
  updateMember: (
    id: number,
    memberId: number,
    body: { workspaceRoleId?: number | null; isActive?: boolean },
  ) =>
    apiClient.patch<{ message: string }>(
      `/v1/workspaces/${id}/members/${memberId}`,
      body,
    ),
  removeMember: (id: number, memberId: number) =>
    apiClient.delete<{ message: string }>(
      `/v1/workspaces/${id}/members/${memberId}`,
    ),
};
