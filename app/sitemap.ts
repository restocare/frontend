import type { MetadataRoute } from "next";
import { INDEXABLE_CATEGORY_SLUGS } from "@/lib/category-slugs";

const SITE_URL = "https://www.restocare.in";

// Phase 1 URL lock: exactly these URLs, nothing else. Legal pages stay out
// until they return 200; coming-soon categories stay out and are noindex.
const PATHS = [
  "",
  "/about",
  "/contact",
  ...INDEXABLE_CATEGORY_SLUGS.map((slug) => `/category/${slug}`),
  "/guides/restaurant-staffing-prices",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
  }));
}
