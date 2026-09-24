import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Restaurant Cleaning Chemicals & Kitchen Supplies",
  description:
    "Food-safe degreasers, sanitizers and cleaning chemicals for commercial kitchens, supplied in bulk to restaurants across Delhi NCR.",
  alternates: {
    canonical: "https://www.restocare.in/products",
  },
  openGraph: {
    title: "Restaurant Cleaning Chemicals & Kitchen Supplies | RestoCare",
    description:
      "Food-safe degreasers, sanitizers and cleaning chemicals for commercial kitchens, supplied in bulk to restaurants across Delhi NCR.",
    url: "https://www.restocare.in/products",
    siteName: "RestoCare",
    locale: "en_IN",
    type: "website",
  },
};

export default function ProductsLayout({ children }: { children: ReactNode }) {
  return children;
}
