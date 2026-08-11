import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  /**
   * HTML/RSC no deben cachearse agresivo: tras un deploy los chunks cambian
   * y un HTML viejo apunta a /_next/static/... inexistente → "This page couldn't load".
   * Los assets hasheados en /_next/static sí pueden ser immutable.
   */
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-cache, no-store, max-age=0, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
