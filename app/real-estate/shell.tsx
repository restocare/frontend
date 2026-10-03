"use client";
import { ADMIN_LOGIN_PATH } from "@/src/lib/admin-routes";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import { useAuthStore, seedAuthFromPanelSession } from "@/store/authStore";
import { authApi } from "@/app/api/api";
import { startBar, finishBar } from "@/components/navigation-progress";
import { DataPrefetcher } from "@/components/providers/DataPrefetcher";

// Stable no-op subscription for the client-only hydration flag below.
const emptySubscribe = () => () => {};

// Ported dashboard shell from the ai-sales-agent reference frontend, mounted
// at /real-estate inside the restocare panel. Auth is the PANEL session — the
// zustand store is seeded from the rc.* localStorage keys on first load.
export default function RealEstateShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  // True only after client hydration, so the persisted (localStorage) token has
  // been rehydrated before we decide whether to redirect — otherwise a reload
  // bounces to /login. useSyncExternalStore avoids setState-in-effect.
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const { accessToken, setAuth } = useAuthStore();
  const router = useRouter();

  // Drive the top progress bar during the skeleton/loading phase.
  // `booted` tracks whether we've already completed the initial load bar so
  // subsequent in-dashboard navigations are handled only by ProgressWatcher.
  const booted = useRef(false);
  useEffect(() => {
    const ready = hydrated && !!accessToken;
    if (ready && !booted.current) {
      booted.current = true;
      finishBar();
    } else if (!ready && !booted.current) {
      startBar();
    }
  }, [hydrated, accessToken]);

  useEffect(() => {
    if (!hydrated) return;

    // No token in the mirror store → try seeding from the panel session first
    // (rc.* keys written by /login). Only when that also fails is the user
    // genuinely logged out. Defer the navigation to a macrotask so it
    // dispatches after the App Router has initialized (avoids the "Router
    // action dispatched before initialization" error on first load).
    if (!accessToken) {
      if (seedAuthFromPanelSession()) return; // store updated → effect re-runs
      const id = setTimeout(() => router.replace(ADMIN_LOGIN_PATH), 0);
      return () => clearTimeout(id);
    }

    const syncUser = async () => {
      try {
        const userData = await authApi.getMe();
        if (userData) {
          setAuth(accessToken, userData);
        }
      } catch (err) {
        console.error("Error syncing user data on mount:", err);
      }
    };
    syncUser();
  }, [hydrated, accessToken, setAuth, router]);

  // Skeleton shell for the brief hydration window — gives the browser pixels
  // to paint immediately (improves FCP/LCP) instead of a blank screen.
  const skeletonShell = (
    <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden" aria-hidden="true">
      {/* Header skeleton */}
      <div className="h-14 border-b border-border flex items-center px-4 lg:px-6 gap-4 shrink-0 bg-background">
        <div className="h-5 w-10 rounded bg-muted animate-pulse" />
        <div className="h-7 w-60 rounded-md bg-muted/60 animate-pulse hidden md:block" />
        <div className="ml-auto flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-muted animate-pulse" />
          <div className="h-7 w-7 rounded-md bg-muted animate-pulse" />
          <div className="h-7 w-7 rounded-md bg-muted animate-pulse" />
        </div>
      </div>
      {/* Body skeleton */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar skeleton */}
        <div className="hidden lg:flex w-56 border-r border-border flex-col gap-2 p-3 shrink-0">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-muted/60 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
        {/* Main content skeleton */}
        <div className="flex-1 p-6 flex flex-col gap-4">
          <div className="h-7 w-48 rounded bg-muted animate-pulse" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-lg bg-muted/60 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
          <div className="h-64 rounded-lg bg-muted/40 animate-pulse" />
        </div>
      </div>
    </div>
  );

  if (!hydrated) return skeletonShell;
  if (!accessToken) return skeletonShell;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground font-sans overflow-hidden">
      <DataPrefetcher />
      <Header
        onMenuClick={() => setIsMobileMenuOpen(true)}
        onDesktopToggle={() => setIsDesktopSidebarOpen((prev) => !prev)}
        isDesktopSidebarOpen={isDesktopSidebarOpen}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          isDesktopOpen={isDesktopSidebarOpen}
          onDesktopToggle={() => setIsDesktopSidebarOpen((prev) => !prev)}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 p-4 lg:p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}