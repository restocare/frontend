import type { ReactNode } from "react";
import { DashboardShell } from "./_shell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
