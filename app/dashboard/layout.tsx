import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardShell } from "./_shell";

export const metadata: Metadata = {
  title: { absolute: "RestoCare Admin" },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
