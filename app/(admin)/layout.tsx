import type { Metadata } from "next";
import type { ReactNode } from "react";
import { themeInitScript } from "@/src/lib/theme";

// Admin console (dashboard + login) config, kept out of the root layout so
// the storefront isn't served the admin's dark theme or "RestoCare Admin"
// title/noindex defaults. Lives here until the admin console moves to
// admin.restocare.in.
export const metadata: Metadata = {
  title: { absolute: "RestoCare Admin" },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      {children}
    </>
  );
}
