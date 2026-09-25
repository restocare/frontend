import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description:
    "The Terms & Conditions that govern your use of RestoCare, operated by Restroedge Private Limited.",
  alternates: {
    canonical: "https://www.restocare.in/terms-and-conditions",
  },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Terms & Conditions | RestoCare",
    description:
      "The Terms & Conditions that govern your use of RestoCare, operated by Restroedge Private Limited.",
    url: "https://www.restocare.in/terms-and-conditions",
    siteName: "RestoCare",
    locale: "en_IN",
    type: "website",
  },
};

export default function TermsLayout({ children }: { children: ReactNode }) {
  return children;
}
