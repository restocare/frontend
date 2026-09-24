import type { Metadata } from "next";
import { HomeContent } from "./_home-content";

// TODO: update title and description once repair categories (Plumber, Electrician,
// Technician, AC & Appliance Repair) are published — they are "Coming soon" as of now.
export const metadata: Metadata = {
  title: {
    absolute: "RestoCare — Restaurant Staff & Kitchen Services, Delhi NCR",
  },
  description:
    "Book verified chefs, kitchen helpers and waiters by the shift, and commercial kitchen deep cleaning, across Delhi NCR. Clear pricing, booked and tracked online.",
  alternates: {
    canonical: "https://www.restocare.in",
  },
  openGraph: {
    title: "RestoCare — Restaurant Staff & Kitchen Services, Delhi NCR",
    description:
      "Book verified chefs, kitchen helpers and waiters by the shift, and commercial kitchen deep cleaning, across Delhi NCR. Clear pricing, booked and tracked online.",
    url: "https://www.restocare.in",
    siteName: "RestoCare",
    locale: "en_IN",
    type: "website",
  },
};

export default function Home() {
  return <HomeContent />;
}
