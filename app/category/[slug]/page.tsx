import { notFound } from "next/navigation";
import { categoryIdForSlug } from "@/lib/category-slugs";
import { CategoryPageClient } from "./category-page-client";

/**
 * Server boundary so an unmapped slug 404s for real. Calling notFound() from
 * the co-located Client Component (or from layout.tsx's generateMetadata)
 * can't reliably set the HTTP status here — metadata streams concurrently
 * with the page shell, and the shell's 200 is already committed by the time
 * generateMetadata resolves. Checking here, before anything renders, is what
 * makes the status code stick.
 */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (categoryIdForSlug(slug) === undefined) notFound();

  return <CategoryPageClient />;
}
