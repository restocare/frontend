import type { NextConfig } from "next";
import { REDIRECT_RULES } from "./lib/redirects";

const nextConfig: NextConfig = {
  async redirects() {
    return REDIRECT_RULES;
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
