import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How RestoCare (Restroedge Private Limited) collects, uses and protects data from restaurants, customers and service partners.",
  alternates: {
    canonical: "https://www.restocare.in/privacy-policy",
  },
  openGraph: {
    title: "Privacy Policy | RestoCare",
    description:
      "How RestoCare (Restroedge Private Limited) collects, uses and protects data from restaurants, customers and service partners.",
    url: "https://www.restocare.in/privacy-policy",
    siteName: "RestoCare",
    locale: "en_IN",
    type: "website",
  },
};

export default function PrivacyPolicyLayout({ children }: { children: ReactNode }) {
  return children;
}
