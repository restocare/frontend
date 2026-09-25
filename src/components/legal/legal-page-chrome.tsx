"use client";

import { useState } from "react";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { CursorFollower } from "@/src/components/landing/cursor-follower";

interface Props {
  title: string;
  children: React.ReactNode;
}

export function LegalPageChrome({ title, children }: Props) {
  const [search, setSearch] = useState("");

  return (
    <div data-theme="light" className="min-h-dvh bg-gray-50">
      <CursorFollower />
      <LandingHeader search={search} onSearchChange={setSearch} />

      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:py-16">
        {/* Hero */}
        <div className="mb-12 rounded-3xl bg-gradient-to-br from-[#0A192F] to-[#1a3a5c] px-8 py-12 text-white shadow-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80 ring-1 ring-white/20">
            ⚖️ Legal
          </span>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight sm:text-4xl">
            {title}
          </h1>
        </div>

        {/* Markdown content */}
        {children}
      </main>

      <Footer />
    </div>
  );
}
