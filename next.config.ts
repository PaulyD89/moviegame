import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The share-card route reads its font and logo from disk.
  outputFileTracingIncludes: { "/api/share/daily": ["./assets/**"] },
  partialPrefetching: true,
  images: {
    // TMDB already serves sized images from its CDN.
    unoptimized: true,
    remotePatterns: [{ protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" }],
  },
  async headers() {
    return [
      {
        // The service worker must always be fresh so notification fixes reach phones.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
