import type { MetadataRoute } from "next";

const SITE_URL = "https://www.restocare.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/login",
        "/account/login",
        "/delete-account",
        "/payment/*",
        "/api/*",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
