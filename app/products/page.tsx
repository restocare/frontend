import type { Metadata } from "next";
import { ProductsContent } from "./_products-content";

export const metadata: Metadata = {
  title: { absolute: "Restaurant Cleaning Chemicals & Kitchen Supplies | RestoCare" },
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

export default function ProductsPage() {
  return <ProductsContent />;
}
