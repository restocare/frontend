"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  cartApi,
  customerAuthApi,
  normalizeMobileNumber,
  type CustomerUser,
} from "@/src/api/api";
import {
  clearAuth,
  getToken,
  setRefreshToken,
  setSessionId,
  setToken,
} from "@/src/api/apiClient";

// Guest cart session id — kept in sync with SESSION_KEY in src/lib/cart.tsx.
const CART_SESSION_KEY = "rc_cart_session";

const USER_KEY = "rc.customer";
const DEVICE_KEY = "rc.deviceId";

function getDeviceId(): string {
  if (typeof window === "undefined") return "web";
  try {
    let id = window.localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `device_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
      window.localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "web";
  }
}

function readStoredUser(): CustomerUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as CustomerUser) : null;
  } catch {
    return null;
  }
}

interface CustomerAuthValue {
  user: CustomerUser | null;
  isLoggedIn: boolean;
  isHydrating: boolean;
  isLoading: boolean;
  sendOtp: (mobile: string) => Promise<void>;
  resendOtp: (mobile: string) => Promise<void>;
  verifyOtp: (mobile: string, otp: string) => Promise<void>;
  logout: () => void;
  /** Merge fields into the signed-in customer (after a profile update) and
   *  keep the stored copy in sync. */
  updateUser: (patch: Partial<CustomerUser>) => void;
}

const CustomerAuthContext = createContext<CustomerAuthValue | null>(null);

export function useCustomerAuth(): CustomerAuthValue {
  const ctx = useContext(CustomerAuthContext);
  if (!ctx) throw new Error("useCustomerAuth must be used within <CustomerAuthProvider>");
  return ctx;
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const queryClient = useQueryClient();

  // Hydrate the stored customer (only treat as logged in if a token is present
  // too). Deferred to a microtask so we never setState synchronously in-effect.
  useEffect(() => {
    queueMicrotask(() => {
      const stored = readStoredUser();
      if (stored && getToken()) setUser(stored);
      setIsHydrating(false);
    });
  }, []);

  const sendOtp = useCallback(async (mobile: string) => {
    setIsLoading(true);
    try {
      const res = await customerAuthApi.generateOtp(normalizeMobileNumber(mobile));
      if (res.success === false && res.message) throw new Error(res.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resendOtp = useCallback(async (mobile: string) => {
    setIsLoading(true);
    try {
      await customerAuthApi.resendOtp(normalizeMobileNumber(mobile));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (mobile: string, otp: string) => {
    setIsLoading(true);
    try {
      const res = await customerAuthApi.verifyOtp({
        otp_input: otp.replace(/\D/g, ""),
        mobile: normalizeMobileNumber(mobile),
        fcmToken: "",
        deviceId: getDeviceId(),
        platform: "web",
      });

      if (!res.accessToken) {
        throw new Error(res.message || "Verification failed. Please try again.");
      }

      setToken(res.accessToken);
      if (res.refreshToken) setRefreshToken(res.refreshToken);
      if (res.sessionId) setSessionId(res.sessionId);

      const nextUser: CustomerUser =
        res.user ?? { id: normalizeMobileNumber(mobile), mobile: normalizeMobileNumber(mobile) };
      try {
        window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      } catch {
        /* ignore */
      }
      setUser(nextUser);

      // Restore the guest cart into the now-authenticated account. The token is
      // already stored (setToken above), so cartApi.merge carries it. Best-effort:
      // a merge failure must not block a successful login.
      try {
        const guestSessionId = window.localStorage.getItem(CART_SESSION_KEY);
        if (guestSessionId) await cartApi.merge(guestSessionId);
      } catch {
        /* best-effort: ignore merge failure */
      }
      // Refetch the cart so it shows the merged items (now resolved via the auth
      // token to the user's cart, not the deleted guest sessionId).
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
    } finally {
      setIsLoading(false);
    }
  }, [queryClient]);

  const logout = useCallback(() => {
    clearAuth();
    try {
      window.localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
    setUser(null);
  }, []);

  const updateUser = useCallback((patch: Partial<CustomerUser>) => {
    setUser((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(USER_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo<CustomerAuthValue>(
    () => ({
      user,
      isLoggedIn: Boolean(user),
      isHydrating,
      isLoading,
      sendOtp,
      resendOtp,
      verifyOtp,
      logout,
      updateUser,
    }),
    [user, isHydrating, isLoading, sendOtp, resendOtp, verifyOtp, logout, updateUser],
  );

  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>;
}
