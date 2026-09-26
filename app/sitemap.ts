import type { MetadataRoute } from "next";
import { categoryTreeApi } from "@/src/api/api";
import { categoryHref } from "@/lib/category-slugs";

const SITE_URL = "https://www.restocare.in";

const STATIC_PATHS = [
  "",
  "/about",
  "/products",
  "/careers",
  "/privacy-policy",
  "/terms-and-conditions",
  "/refund-cancellation-policy",
];

// Re-checked hourly so a category flip from "coming soon" to published
// shows up here without waiting on the next deploy.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));

  let categoryEntries: MetadataRoute.Sitemap = [];
  try {
    const categories = await categoryTreeApi.tree();
    categoryEntries = categories
      .filter((category) => category.isPublished)
      .map((category) => ({
        url: `${SITE_URL}${categoryHref(category.categoryId)}`,
        lastModified: new Date(),
      }));
  } catch (error) {
    console.error("sitemap: failed to fetch categories", error);
  }

  return [...staticEntries, ...categoryEntries];
}
