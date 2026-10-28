import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import type { UserRoleRef } from "@/app/api/api";

interface User {
  id: string;
  email: string;
  tenantId: string | null;
  roles: UserRoleRef[];
  permissions: string[];
  ai_mode?: boolean;
}

interface AuthState {
  accessToken: string | null;
  user: User | null;

  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setAiMode: (aiMode: boolean) => void;
}

// On the server there is no localStorage; fall back to a no-op so SSR doesn't throw.
const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,

      setAuth: (token, user) =>
        set({
          accessToken: token,
          user,
        }),

      clearAuth: () =>
        set({
          accessToken: null,
          user: null,
        }),

      setAiMode: (aiMode) =>
        set((state) => ({
          user: state.user ? { ...state.user, ai_mode: aiMode } : state.user,
        })),
    }),
    {
      // Persist the user so a page reload keeps the profile, but never the
      // token: rc.accessToken (src/api/apiClient.ts) is its only stored copy,
      // and the shell re-seeds this store from it on load.
      name: "tsk-auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : noopStorage,
      ),
      partialize: (state) => ({
        user: state.user,
      }),
    },
  ),
);

/**
 * Bridge: seed this store from the restocare PANEL session (rc.* localStorage
 * keys written by /login). The real-estate section has no login flow of its
 * own — the panel session is the source of truth; this store is a mirror the
 * ported components (usePermissions, PermissionGate, apiClient) read from.
 *
 * Panel admins hold "*" permissions → normalized to the super_admin role so
 * the reference RBAC helpers grant them everything.
 */
export function seedAuthFromPanelSession(): boolean {
  if (typeof window === "undefined") return false;

  const token = window.localStorage.getItem("rc.accessToken");
  if (!token) return false;

  let panelUser: {
    id?: number;
    email?: string | null;
    role?: string;
    tenantId?: string | null;
  } | null = null;
  let permissions: string[] = [];
  let roleNames: string[] = [];
  try {
    panelUser = JSON.parse(window.localStorage.getItem("rc.user") ?? "null");
  } catch {
    panelUser = null;
  }
  try {
    permissions = JSON.parse(window.localStorage.getItem("rc.permissions") ?? "[]");
  } catch {
    permissions = [];
  }
  try {
    roleNames = JSON.parse(window.localStorage.getItem("rc.roleNames") ?? "[]");
  } catch {
    roleNames = [];
  }
  if (!panelUser) return false;

  // Super admins hold "*" → normalized to super_admin so the reference RBAC
  // helpers grant everything. Everyone else surfaces their real role name(s):
  // a tenant user's tenant role (e.g. "admin"/"sales") drives the sidebar and
  // the profile chip; fall back to the SystemRole when no role names are set.
  const roles =
    panelUser.role === "SUPER_ADMIN" || permissions.includes("*")
      ? ["super_admin"]
      : roleNames.length
        ? roleNames
        : [String(panelUser.role ?? "").toLowerCase()];

  useAuthStore.getState().setAuth(token, {
    id: String(panelUser.id ?? ""),
    email: panelUser.email ?? "",
    tenantId: panelUser.tenantId ?? null,
    roles,
    permissions,
  });
  return true;
}
