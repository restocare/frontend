/**
 * Low-level HTTP client used by every API call in the app.
 *
 * - Reads the base URL from `NEXT_PUBLIC_API_BASE_URL`.
 * - Attaches the bearer access token (when present) to every request.
 * - Normalizes errors into a typed `ApiError`.
 *
 * Higher-level, typed endpoint functions live in `./api.ts`.
 */

function resolveApiBaseUrl(): string {
  // Local development must always talk to the local backend, so it works even
  // if a production URL was baked into the build.
  // if (typeof window !== "undefined") {
  //   const host = window.location.hostname;
  //   if (host === "localhost" || host === "127.0.0.1") return "http://localhost:8000/api";
  // }

  // The env-configured URL wins everywhere, localhost included, so `next dev`
  // talks to the live API by default. To develop against a local backend, set
  // NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api in .env.local.
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api.restocare.in/api";
}


export const API_BASE_URL = resolveApiBaseUrl();

const ACCESS_TOKEN_KEY = "rc.accessToken";
const REFRESH_TOKEN_KEY = "rc.refreshToken";
const SESSION_ID_KEY = "rc.sessionId";
const USER_KEY = "rc.user";

/* ----------------------------- token storage ---------------------------- */

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function getSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_ID_KEY);
}

export function setSessionId(sessionId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_ID_KEY, sessionId);
}

/** Wipe every auth artifact (used on logout and when a refresh fails). */
export function clearAuth(): void {
  if (typeof window === "undefined") return;
  [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, SESSION_ID_KEY, USER_KEY].forEach((k) =>
    window.localStorage.removeItem(k),
  );
}

/* ------------------------ silent token refresh -------------------------- */

let refreshPromise: Promise<string | null> | null = null;

/**
 * Exchange the stored refresh token for a fresh access token.
 * Single-flight: concurrent 401s share one refresh request.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  const sessionId = getSessionId();
  if (!refreshToken || !sessionId) return null;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/v1/auth/refresh-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken, sessionId }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { accessToken?: string };
      if (data?.accessToken) {
        setToken(data.accessToken);
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

/** Refresh failed irrecoverably — clear auth and bounce to login (once). */
function forceLogout(): void {
  clearAuth();
  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
  }
}

/* ------------------------------- errors ---------------------------------- */

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/** The backend wraps some responses as { status, message, statusCode, data }. */
function extractMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const message = record.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message) && message.length > 0) return String(message[0]);
  }
  return fallback;
}

/* ------------------------------- request --------------------------------- */

interface RequestOptions extends Omit<RequestInit, "body"> {
  /** Plain JSON-serializable body; do not pre-stringify. */
  body?: unknown;
  /** Skip attaching the Authorization header (e.g. for login). */
  skipAuth?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
  isRetry = false,
): Promise<T> {
  const { body, skipAuth, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    // Ask for money amounts exactly as stored — GST-inclusive totals. Without
    // this the booking list serves a pre-tax figure, for compatibility with an
    // old customer-app build that multiplies it by 1.18 itself.
    "x-amount-format": "inclusive",
    ...(headers as Record<string, string>),
  };

  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }

  if (!skipAuth) {
    const token = getToken();
    if (token) finalHeaders.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      "Unable to reach the server. Please check your connection and try again.",
      0,
    );
  }

  // The access token expired (or is otherwise rejected): try a single silent
  // refresh, then replay the original request once. If the refresh fails, wipe
  // auth and bounce to /login. Skipped for unauthenticated calls and retries.
  if (response.status === 401 && !skipAuth && !isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(path, options, true);
    }
    forceLogout();
  }

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      extractMessage(parsed, response.statusText || "Request failed"),
      response.status,
      parsed,
    );
  }

  return parsed as T;
}

/**
 * Upload multipart form data (e.g. an .xlsx file or an image). Lets the browser
 * set the boundary. `method` defaults to POST; pass PATCH/PUT for updates.
 */
export async function uploadFile<T>(
  path: string,
  formData: FormData,
  method: "POST" | "PATCH" | "PUT" = "POST",
): Promise<T> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
  } catch {
    throw new ApiError("Unable to reach the server. Please try again.", 0);
  }

  const text = await response.text();
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!response.ok) {
    throw new ApiError(extractMessage(parsed, "Upload failed"), response.status, parsed);
  }
  return parsed as T;
}

/** Download a binary response (e.g. an .xlsx template) as a Blob. */
export async function downloadFile(path: string): Promise<Blob> {
  const token = getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) {
    throw new ApiError("Download failed", response.status);
  }
  return response.blob();
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
