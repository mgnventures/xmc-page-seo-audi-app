import type { NextConfig } from "next";

const PAGES_ORIGIN = 'https://pages.sitecorecloud.io'; // e.g. https://pages.sitecorecloud.io or your org-specific origin

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Vary", value: "Origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
