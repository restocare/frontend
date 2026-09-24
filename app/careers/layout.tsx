import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { absolute: "Careers at RestoCare" },
  description:
    "Join RestoCare — we're hiring Operations Executives, Field Service Supervisors, Customer Support Associates and Business Development Managers across Delhi NCR.",
  alternates: {
    canonical: "https://www.restocare.in/careers",
  },
  openGraph: {
    title: "Careers at RestoCare",
    description:
      "Join RestoCare — we're hiring Operations Executives, Field Service Supervisors, Customer Support Associates and Business Development Managers across Delhi NCR.",
    url: "https://www.restocare.in/careers",
    siteName: "RestoCare",
    locale: "en_IN",
    type: "website",
  },
};

export default function CareersLayout({ children }: { children: ReactNode }) {
  return children;
}
