import type { NextConfig } from "next";
import { REDIRECT_RULES } from "./lib/redirects";
import { publishedLegalPaths } from "./lib/legal-pages";

const nextConfig: NextConfig = {
  env: {
    PUBLISHED_LEGAL_PATHS: publishedLegalPaths().join(","),
  },
  async redirects() {
    return REDIRECT_RULES;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Only our own pages may frame the site (clickjacking).
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // Never guess a response's type from its content.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Full URL only to our own origin; other sites get the origin alone.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'randomuser.me',
      },
      {
        protocol: 'https',
        hostname: 'plain-apac-prod-public.komododecks.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },
};

export default nextConfig;
