import type { NextConfig } from "next";
import { REDIRECT_RULES } from "./lib/redirects";
import { publishedLegalPaths } from "./lib/legal-pages";

const nextConfig: NextConfig = {
  // Only the self-hosted Docker build (see Dockerfile) emits a standalone server.
  // Vercel builds leave this unset and are unaffected.
  ...(process.env.BUILD_STANDALONE === "1" ? { output: "standalone" as const } : {}),
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
      {
        // New uploads: the backend's media location (Nginx serves /media/ from the VPS volume).
        protocol: 'https',
        hostname: 'api.restocare.in',
        pathname: '/media/**',
      },
      {
        // Local backend's media URLs (any port: 8092 media server, 8000 dev) so
        // admin-uploaded images render when developing against localhost.
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
};

export default nextConfig;
