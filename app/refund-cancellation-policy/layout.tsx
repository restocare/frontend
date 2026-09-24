import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description:
    "When you can cancel a RestoCare booking, what you get back, and how long refunds take.",
  alternates: {
    canonical: "https://www.restocare.in/refund-cancellation-policy",
  },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Refund & Cancellation Policy | RestoCare",
    description:
      "When you can cancel a RestoCare booking, what you get back, and how long refunds take.",
    url: "https://www.restocare.in/refund-cancellation-policy",
    siteName: "RestoCare",
    locale: "en_IN",
    type: "website",
  },
};

export default function RefundPolicyLayout({ children }: { children: ReactNode }) {
  return children;
}
