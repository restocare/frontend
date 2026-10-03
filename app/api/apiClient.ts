import { ADMIN_LOGIN_PATH } from "@/src/lib/admin-routes";
import axios from "axios";
import { useAuthStore } from "@/store/authStore";

// Ported from the ai-sales-agent reference frontend, bridged to this app:
// - The backend host is derived from the panel's NEXT_PUBLIC_API_BASE_URL
//   (which includes the "/api" prefix) — ported endpoint paths carry their own
//   "/api/..." prefix, so we strip it from the base.
// - Auth is the PANEL session (rc.* localStorage keys written at /login), not
//   the reference app's own login flow. The zustand store is a mirror seeded
//   from those keys (see store/authStore.ts).
const PANEL_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";
const HOST_BASE = PANEL_BASE.replace(/\/api\/?$/, "");

const RC_ACCESS_TOKEN = "rc.accessToken";
const RC_REFRESH_TOKEN = "rc.refreshToken";
const RC_SESSION_ID = "rc.sessionId";

function readPanelToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(RC_ACCESS_TOKEN);
}

const apiClient = axios.create({
  baseURL: HOST_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor
apiClient.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      // Prefer the live panel token (it gets rotated by silent refresh);
      // fall back to the zustand mirror.
      const token = readPanelToken() ?? useAuthStore.getState().accessToken;
      const { user } = useAuthStore.getState();

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Role check for API calls
      const url = config.url || "";
      const firstRole = user?.roles?.[0];
      const primaryRole = typeof firstRole === "string"
        ? firstRole
        : (firstRole?.role?.name || firstRole?.name || "");
      const userRole = primaryRole.toLowerCase().replace(/_/g, "").replace(/\s/g, "");
      const isSuperAdmin = userRole === "superadmin" || userRole === "super admin";

      // Super admin API paths (e.g. clients, audit logs)
      const superAdminApiPrefixes = ["/api/tenants", "/api/audit-logs"];

      // Admin API paths (no specific ones defined yet in api.ts, but can be added here)
      const adminApiPrefixes: string[] = [];

      if (isSuperAdmin) {
        const isTryingToAccessAdminApi = adminApiPrefixes.some((prefix) => url.startsWith(prefix));
        if (isTryingToAccessAdminApi) {
          return Promise.reject(new Error("Unauthorized API Call: Super Admin cannot access Admin APIs"));
        }
      } else {
        const isTryingToAccessSuperAdminApi = superAdminApiPrefixes.some((prefix) => url.startsWith(prefix));
        if (isTryingToAccessSuperAdminApi) {
          return Promise.reject(new Error("Unauthorized API Call: Admin cannot access Super Admin APIs"));
        }
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ---------------------- silent panel-token refresh ----------------------- */
// Mirrors src/api/apiClient.ts: exchange the panel refresh token once
// (single-flight) and replay the failed request. Without this, the ported
// section would bounce to /login every time the 15-minute access token lapses.

let refreshPromise: Promise<string | null> | null = null;

async function refreshPanelToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const refreshToken =
    typeof window !== "undefined" ? window.localStorage.getItem(RC_REFRESH_TOKEN) : null;
  const sessionId =
    typeof window !== "undefined" ? window.localStorage.getItem(RC_SESSION_ID) : null;
  if (!refreshToken || !sessionId) return null;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${PANEL_BASE}/v1/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken, sessionId }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken?: string };
      if (data?.accessToken) {
        window.localStorage.setItem(RC_ACCESS_TOKEN, data.accessToken);
        const { user, setAuth } = useAuthStore.getState();
        if (user) setAuth(data.accessToken, user);
        return data.accessToken;
      }
      return null;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// Response Interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config ?? {};

    if (error.response?.status === 401 && !original.__isRetry) {
      const newToken = await refreshPanelToken();
      if (newToken) {
        original.__isRetry = true;
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return apiClient(original);
      }

      const onLoginPage =
        typeof window !== "undefined" &&
        window.location.pathname.startsWith(ADMIN_LOGIN_PATH);

      if (!onLoginPage) {
        useAuthStore.getState().clearAuth();
        if (typeof window !== "undefined") {
          window.location.href = ADMIN_LOGIN_PATH;
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
