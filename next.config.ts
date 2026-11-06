import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app has no backend: every page is static and all chain access runs in the browser.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // Keep the build rooted in this project even if a parent folder has its own lockfile.
  turbopack: { root: __dirname },
};

export default nextConfig;
