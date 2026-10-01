import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SHOW_PRODUCTS } from "@/src/lib/features";

// While the Products section is hidden (src/lib/features.ts), keep search
// engines from listing it; the pages still open by direct URL.
export const metadata: Metadata = SHOW_PRODUCTS
  ? {}
  : { robots: { index: false, follow: false } };

export default function ProductsLayout({ children }: { children: ReactNode }) {
  return children;
}
