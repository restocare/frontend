import type { MetadataRoute } from "next";

const SITE_URL = "https://www.restocare.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /login carries noindex (see app/login/layout.tsx) but is deliberately
      // left off this list: Googlebot needs to crawl it to see that tag before
      // it can be dropped from the index (it's already indexed today). Add it
      // back here once GSC confirms the URL is out of the index.
      disallow: [
        "/account/login",
        "/delete-account",
        "/payment/*",
        "/api/*",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
