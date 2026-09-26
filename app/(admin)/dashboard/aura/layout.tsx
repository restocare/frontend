"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Shell for the panel's Aura section. The sidebar already links each tab, but
 * a local tab bar keeps the section navigable once you're inside it (and makes
 * the user-detail page's parent obvious).
 */
const TABS = [
  { href: "/dashboard/aura", label: "Overview", exact: true },
  { href: "/dashboard/aura/users", label: "Users" },
  { href: "/dashboard/aura/catalog", label: "App Catalog" },
  { href: "/dashboard/aura/scoring", label: "Scoring" },
  { href: "/dashboard/aura/settings", label: "Settings" },
];

export default function AuraLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Aura</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The AI life tracker — fleet health, app classification and the weights behind every
          user&apos;s productivity score.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-border pb-3">
        {TABS.map((tab) => {
          const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
