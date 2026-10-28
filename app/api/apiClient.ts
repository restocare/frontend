import axios from "axios";
import {
  API_BASE_URL,
  forceLogout,
  getToken,
  refreshAccessToken,
} from "@/src/api/apiClient";
import { useAuthStore } from "@/store/authStore";

// Ported from the ai-sales-agent reference frontend, bridged to this app:
// - The backend host is the panel's API base without its "/api" suffix —
//   ported endpoint paths carry their own "/api/..." prefix.
// - Auth is the PANEL session. Token storage and the silent refresh live in
//   src/api/apiClient.ts (the single owner of the rc.* keys); the zustand
//   store is only an in-memory mirror of it (see store/authStore.ts).
const HOST_BASE = API_BASE_URL.replace(/\/api\/?$/, "");

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
      // The stored panel token is the live one (silent refresh rotates it);
      // the zustand mirror only backs it up within the same page.
      const token = getToken() ?? useAuthStore.getState().accessToken;
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
// Same single-flight refresh as the fetch client, then replay the failed
// request once. Without this, the ported section would bounce to /login every
// time the 15-minute access token lapses.

// Response Interceptor
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config ?? {};

    if (error.response?.status === 401 && !original.__isRetry) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        const { user, setAuth } = useAuthStore.getState();
        if (user) setAuth(newToken, user);
        original.__isRetry = true;
        original.headers = { ...original.headers, Authorization: `Bearer ${newToken}` };
        return apiClient(original);
      }

      // Refresh failed: wipe the mirror and the stored session (forceLogout
      // clears the rc.* keys too, so /login cannot bounce straight back in).
      useAuthStore.getState().clearAuth();
      forceLogout();
    }

    return Promise.reject(error);
  }
);

export default apiClient;
