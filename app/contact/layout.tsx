import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Talk to RestoCare about restaurant staffing, kitchen deep cleaning or supplies in Delhi NCR. Call, WhatsApp or email our team.",
  alternates: {
    canonical: "https://www.restocare.in/contact",
  },
  openGraph: {
    title: "Contact Us | RestoCare",
    description:
      "Talk to RestoCare about restaurant staffing, kitchen deep cleaning or supplies in Delhi NCR. Call, WhatsApp or email our team.",
    url: "https://www.restocare.in/contact",
    siteName: "RestoCare",
    locale: "en_IN",
    type: "website",
  },
};

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
