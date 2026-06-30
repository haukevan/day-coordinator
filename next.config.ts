import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// A revision helps Serwist version precached pages. Using a UUID since
// we don't have a git-based revision in all environments.
const revision = crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision }],
});

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; " +
              "script-src 'self' 'unsafe-inline'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: https:; " +
              "font-src 'self'; " +
              "connect-src 'self' https://*.supabase.co https://nominatim.openstreetmap.org https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://tiles.openfreemap.org https://api.maptiler.com; " +
              "worker-src 'self' blob:; " +
              "child-src 'self' blob:; " +
              "manifest-src 'self';",
          },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
