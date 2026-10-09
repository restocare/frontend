"use client";

import { clearAuth, getToken, setRefreshToken, setToken } from "@/src/api/apiClient";
import type { AdminUser } from "@/src/api/api";

const SESSION_KEY = "rc.sessionId";
const USER_KEY = "rc.user";
const PERMS_KEY = "rc.permissions";
const ROLES_KEY = "rc.roleNames";
/** Fired when the session's permissions are re-synced from the server. */
const PERMS_EVENT = "rc.permissions-changed";

/** Persist the auth result from a successful login. */
export function persistSession(params: {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  user: AdminUser;
  permissions?: string[];
  roleNames?: string[];
}) {
  setToken(params.accessToken);
  // The refresh token is required for the silent token refresh in apiClient;
  // without it, the first 401 after the access token expires forces a logout.
  setRefreshToken(params.refreshToken);
  try {
    window.localStorage.setItem(SESSION_KEY, params.sessionId);
    window.localStorage.setItem(USER_KEY, JSON.stringify(params.user));
    // Older sessions predate the RBAC rollout: admins fall back to "*" below.
    window.localStorage.setItem(PERMS_KEY, JSON.stringify(params.permissions ?? []));
    window.localStorage.setItem(ROLES_KEY, JSON.stringify(params.roleNames ?? []));
  } catch {
    /* ignore */
  }
}

/** RBAC role names of the signed-in STAFF member (e.g. ["marketing"]). */
export function getRoleNames(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ROLES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Permissions of the current session ("*" = everything).
 *
 * ALWAYS the server's answer — the login response, refreshed from
 * `/v1/rbac/me/permissions` while the panel is open. There is deliberately no
 * client-side fallback that infers access from the account role: this list is
 * only ever what the backend granted, so nothing the frontend does can widen
 * it. An unreadable or absent value means "nothing granted yet", never "all".
 *
 * Note this list drives the MENU only. It is not the access control — every
 * endpoint behind these pages enforces the same permission server-side, so
 * editing this value (or the nav) reveals empty pages and 403s, not data.
 */
export function getPermissions(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(PERMS_KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Replace the session's permissions with what the server currently grants.
 *
 * Permissions used to be a login snapshot, so revoking one left the signed-in
 * user with their old menu until they logged out and back in. The dashboard
 * re-syncs on load and on window focus; the event redraws the sidebar at once,
 * and the `storage` listener carries the change to the user's other tabs.
 */
export function setPermissions(permissions: string[]): void {
  if (typeof window === "undefined") return;
  const next = JSON.stringify(permissions);
  if (window.localStorage.getItem(PERMS_KEY) === next) return;
  window.localStorage.setItem(PERMS_KEY, next);
  window.dispatchEvent(new Event(PERMS_EVENT));
}

/** Subscribe to permission changes (this tab via the event, others via storage). */
export function subscribePermissions(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PERMS_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(PERMS_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Stable snapshot for useSyncExternalStore — a string, not a fresh array. */
export function permissionsSnapshot(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(PERMS_KEY) ?? "";
}

export function hasPermission(key: string): boolean {
  const perms = getPermissions();
  return perms.includes("*") || perms.includes(key);
}

/** True only for the SUPER_ADMIN account role (admins/staff are below it). */
export function isSuperAdmin(): boolean {
  return getStoredUser()?.role === "SUPER_ADMIN";
}

export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_KEY);
}

export function getStoredUser(): AdminUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

/**
 * An admin-console session: a token AND a stored admin user. The token key is
 * shared with the storefront's customer login, so the token alone would let a
 * logged-in customer into the console shell.
 */
export function isAuthenticated(): boolean {
  return Boolean(getToken() && getStoredUser());
}

export function clearSession() {
  // clearAuth wipes the access token, refresh token, session id and user —
  // the same keys persistSession writes — so logout leaves nothing behind.
  clearAuth();
}
