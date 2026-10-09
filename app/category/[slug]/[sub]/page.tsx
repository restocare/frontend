import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { categoryIdForSlug } from "@/lib/category-slugs";
import { CATEGORY_TREE_ALL_KEY, fetchCategoryTree } from "@/lib/category-tree-server";
import { DEEP_CLEANING_FLOW } from "@/src/lib/deep-cleaning-flow";
import { isCleaningCategory, subSlugOf } from "@/src/lib/booking-v2/cleaning";
import { CleaningPageV2 } from "@/src/components/booking-v2/cleaning-page";
import { CATEGORY_FLOW } from "@/src/lib/category-flow";
import { CategoryFlowV2Page } from "@/src/components/category-flow-v2/category-page";

const SITE = "https://www.restocare.in";

type Params = Promise<{ slug: string; sub: string }>;

async function findArea(slug: string, sub: string) {
  const categoryId = categoryIdForSlug(slug);
  if (categoryId === undefined) return { categoryId, tree: null, category: undefined, group: undefined };
  const tree = await fetchCategoryTree();
  const category = tree?.find((c) => c.categoryId === categoryId);
  const group = category?.groups.find((g) => subSlugOf(g.name) === sub);
  return { categoryId, tree, category, group };
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug, sub } = await params;
  const { category, group } = await findArea(slug, sub);
  const title = group ? group.title || `${group.name} ${category?.name ?? ""}`.trim() : "Deep Cleaning";
  return {
    title: `${title} in Delhi NCR`,
    description: group?.subtitle || group?.description || category?.description || undefined,
    alternates: { canonical: `${SITE}/category/${slug}/${sub}` },
    // Not in the sitemap yet; the category page stays the indexed one.
    robots: { index: false, follow: true },
  };
}

/** One Deep Cleaning area as its own page, e.g. /category/deep-cleaning/washroom. */
export default async function CleaningAreaPage({ params }: { params: Params }) {
  const { slug, sub } = await params;
  const { categoryId, tree, category, group } = await findArea(slug, sub);

  if (categoryId === undefined) notFound();

  // Same server-side head start as the category page: the first HTML
  // already has the packages instead of a spinner.
  const queryClient = new QueryClient();
  if (tree) queryClient.setQueryData(CATEGORY_TREE_ALL_KEY, tree);

  // New category flow (NEXT_PUBLIC_RC_CATEGORY_FLOW=2), built separately.
  if (CATEGORY_FLOW === 2) {
    // Unknown categories or areas are a real 404 once the catalogue loaded.
    if (tree && (!category || !group)) notFound();
    return (
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CategoryFlowV2Page slug={slug} sub={sub} />
      </HydrationBoundary>
    );
  }

  // Area pages belong to the new cleaning design only.
  if (DEEP_CLEANING_FLOW !== 2) redirect(`/category/${slug}`);
  // With the catalogue loaded, unknown categories or areas are a real 404.
  // If the API is down the client page shows its own error instead.
  if (tree && (!category || !isCleaningCategory(category.name) || !group)) notFound();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={null}>
        <CleaningPageV2 subSlug={sub} />
      </Suspense>
    </HydrationBoundary>
  );
}
