import type { MetadataRoute } from "next";
import { categoryTreeApi } from "@/src/api/api";

const SITE_URL = "https://www.restocare.in";

// Static, always-live content pages. terms-and-conditions and
// refund-cancellation-policy are intentionally left out until those pages
// ship — a sitemap URL that 404s is worse than not listing it.
const STATIC_PATHS = ["", "/products", "/careers", "/privacy-policy"];

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
        url: `${SITE_URL}/category/${category.categoryId}`,
        lastModified: new Date(),
      }));
  } catch (error) {
    console.error("sitemap: failed to fetch categories", error);
  }

  return [...staticEntries, ...categoryEntries];
}
