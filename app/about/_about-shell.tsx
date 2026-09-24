"use client";

import { useState, type ReactNode } from "react";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";
import { CursorFollower } from "@/src/components/landing/cursor-follower";

export function AboutShell({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("");
  return (
    <div data-theme="light" className="min-h-dvh bg-white">
      <CursorFollower />
      <LandingHeader search={search} onSearchChange={setSearch} />
      {children}
      <Footer />
    </div>
  );
}
