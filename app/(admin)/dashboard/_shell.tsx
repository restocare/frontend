"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Toaster } from "sonner";
import {
  Sidebar,
  firstAllowedRoute,
  isTenantUser,
  routeAllowed,
} from "@/src/components/dashboard/sidebar";
import { Topbar } from "@/src/components/dashboard/topbar";
import { ConfirmDialog } from "@/src/components/dashboard/confirm-dialog";
import { SpinnerIcon } from "@/src/components/icons";
import { authApi, rbacApi } from "@/src/api/api";
import {
  clearSession,
  getSessionId,
  getStoredUser,
  isAuthenticated,
  permissionsSnapshot,
  setPermissions,
} from "@/src/lib/auth";

// No-op store: the auth snapshot only needs to be read once on the client.
const noopSubscribe = () => () => {};

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // `undefined` while we don't yet know (server render + hydration), then the
  // real boolean once the client reads localStorage. Using `undefined` as the
  // "checking" state means the redirect effect never fires on a transient value
  // during hydration — it only redirects on a confirmed `false`.
  const authed = useSyncExternalStore<boolean | undefined>(
    noopSubscribe,
    isAuthenticated,
    () => undefined,
  );
  const user = useMemo(() => (authed ? getStoredUser() : null), [authed]);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    if (authed === false) router.replace("/login");
  }, [authed, router]);

  // 🔐 Permissions are the SERVER's answer, kept current while the panel is
  // open. They used to be captured once at login, so a permission the super
  // admin revoked stayed on the user's menu until they logged out and back in.
  // Refetched on focus, which is when a change made elsewhere would land.
  const { data: livePermissions } = useQuery({
    queryKey: ["me", "permissions"],
    queryFn: () => rbacApi.myPermissions(),
    enabled: !!authed && !isTenantUser(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  useEffect(() => {
    if (livePermissions) setPermissions(livePermissions);
  }, [livePermissions]);

  // Tenant (SaaS) users have no place in the admin panel — send them to their
  // /real-estate section instead of rendering the console shell.
  useEffect(() => {
    if (authed && isTenantUser()) router.replace("/real-estate");
  }, [authed, router]);

  // Panel users may only open pages their permissions grant — bounce deep
  // links to their first allowed page. Held until permissions are known
  // (stored from login, or freshly synced): acting on an empty list would
  // bounce a legitimate deep link during the first paint.
  const permissionsKnown = !!livePermissions || permissionsSnapshot() !== "";
  useEffect(() => {
    if (permissionsKnown && authed && !isTenantUser() && !routeAllowed(pathname)) {
      const fallback = firstAllowedRoute();
      if (fallback !== pathname) router.replace(fallback);
    }
  }, [permissionsKnown, authed, pathname, router]);

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const sessionId = getSessionId();
      if (sessionId) {
        // Best-effort server logout; never block the client redirect on it.
        await authApi.logout(sessionId).catch(() => undefined);
      }
    },
    onSettled: () => {
      clearSession();
      router.replace("/login");
    },
  });

  const handleLogout = () => {
    setLogoutConfirmOpen(false);
    logoutMutation.mutate();
  };

  if (!authed) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-muted-foreground">
        <SpinnerIcon className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <Toaster richColors position="top-right" />
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={() => setLogoutConfirmOpen(true)}
      />

      <div className={`transition-all duration-300 ${collapsed ? "lg:pl-20" : "lg:pl-64"}`}>
        <Topbar
          user={user}
          onToggleSidebar={() => setCollapsed((v) => !v)}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>

      {logoutConfirmOpen && (
        <ConfirmDialog
          title="Log out"
          message="Are you sure you want to log out?"
          confirmLabel="Log out"
          danger
          busy={logoutMutation.isPending}
          onConfirm={handleLogout}
          onCancel={() => setLogoutConfirmOpen(false)}
        />
      )}
    </div>
  );
}
