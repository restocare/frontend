"use client";

import { useState, type ReactNode } from "react";
import { LandingHeader } from "@/src/components/landing/landing-header";
import { Footer } from "@/src/components/landing/footer";

export function GuideShell({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState("");
  return (
    <div data-theme="light" className="min-h-dvh bg-white">
      <LandingHeader search={search} onSearchChange={setSearch} />
      {children}
      <Footer />
    </div>
  );
}
