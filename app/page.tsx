import type { Metadata } from "next";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import {
  CATEGORY_TREE_ALL_KEY,
  fetchCategoryTree,
} from "@/lib/category-tree-server";
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

/**
 * Seeds the category tree into React Query's cache so the Popular categories
 * tiles (and their /category/<slug> links) are in the first HTML response
 * instead of appearing after a client fetch. null on an API failure: render
 * as before and let the client fetch.
 */
export default async function Home() {
  const tree = await fetchCategoryTree();
  const queryClient = new QueryClient();
  if (tree) queryClient.setQueryData(CATEGORY_TREE_ALL_KEY, tree);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <HomeContent />
    </HydrationBoundary>
  );
}
