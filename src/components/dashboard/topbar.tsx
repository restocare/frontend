"use client";

import Link from "next/link";
import { ThemeToggle } from "@/src/components/theme-toggle";
import { MenuIcon, SearchIcon } from "@/src/components/icons";
import { NotificationBell } from "@/src/components/dashboard/notification-bell";
import { NewBookingAlarm } from "@/src/components/dashboard/new-booking-alarm";
import { getRoleNames } from "@/src/lib/auth";
import type { AdminUser } from "@/src/api/api";

interface TopbarProps {
  user: AdminUser | null;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
}

const titleCase = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function Topbar({ user, onToggleSidebar, onOpenMobile }: TopbarProps) {
  const name = user?.name?.trim() || user?.email || "Admin";
  const initial = name.charAt(0).toUpperCase();
  // STAFF show their assigned RBAC role(s) ("Marketing"), admins their level.
  const roleNames = user?.role === "STAFF" ? getRoleNames() : [];
  const roleLabel = roleNames.length
    ? roleNames.map(titleCase).join(" · ")
    : (user?.role ?? "ADMIN");

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      {/* Desktop collapse */}
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Collapse sidebar"
        className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground lg:flex"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      {/* Mobile open */}
      <button
        type="button"
        onClick={onOpenMobile}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      {/* Brand: logo + name (desktop only) */}
      <Link
        href="/dashboard"
        className="hidden items-center gap-2.5 transition-opacity hover:opacity-80 lg:flex"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://imgproxy.royodispatch.com/insecure/fit/300/100/sm/0/plain/https://restocare-asset.s3.ap-south-1.amazonaws.com/assets/Clientlogo/FE4tX1iKGv1yJIk1JijoEtq11jm1yGTIdMPIUjpa.png"
          alt="RestoCare Logo"
          className="h-8 w-8 shrink-0 rounded-[5px] object-cover"
        />
        <span className="text-lg font-semibold text-foreground">Restocare</span>
      </Link>

      {/* Search */}
      <div className="relative hidden flex-1 max-w-md sm:block">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search…"
          className="w-full rounded-xl border border-border bg-card py-2 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30"
        />
      </div>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <ThemeToggle />

        <NotificationBell />
        {/* Rings and pops the moment a booking lands, rather than waiting for
            the bell's next minute-long poll. */}
        <NewBookingAlarm />

        <div className="flex items-center gap-3 rounded-xl border border-border bg-card py-1.5 pl-1.5 pr-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-semibold text-white">
            {initial}
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="max-w-[10rem] truncate text-sm font-medium text-foreground">{name}</p>
            <p className="max-w-[10rem] truncate text-xs text-muted-foreground" title={roleLabel}>
              {roleLabel}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
