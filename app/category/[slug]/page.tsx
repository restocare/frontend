import { notFound } from "next/navigation";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { categoryIdForSlug } from "@/lib/category-slugs";
import {
  CATEGORY_TREE_ALL_KEY,
  fetchCategoryTree,
} from "@/lib/category-tree-server";
import { categoryJsonLd } from "@/lib/category-json-ld";
import { CategoryPageClient } from "./category-page-client";

/**
 * Server boundary so an unmapped slug 404s for real. Calling notFound() from
 * the co-located Client Component (or from layout.tsx's generateMetadata)
 * can't reliably set the HTTP status here — metadata streams concurrently
 * with the page shell, and the shell's 200 is already committed by the time
 * generateMetadata resolves. Checking here, before anything renders, is what
 * makes the status code stick.
 *
 * It also fetches the catalogue here and hands it to the client components
 * through React Query's cache, so the first HTML response already contains
 * the heading, services and prices instead of a loading spinner. The client
 * then refetches with the visitor's location as before.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const categoryId = categoryIdForSlug(slug);
  if (categoryId === undefined) notFound();

  // null on an API failure: render exactly as before and let the client fetch.
  const tree = await fetchCategoryTree();
  const queryClient = new QueryClient();
  if (tree) queryClient.setQueryData(CATEGORY_TREE_ALL_KEY, tree);

  const category = tree?.find((c) => c.categoryId === categoryId);

  return (
    <>
      {category && category.isPublished !== false ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: categoryJsonLd(category, slug) }}
        />
      ) : null}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CategoryPageClient />
      </HydrationBoundary>
    </>
  );
}
