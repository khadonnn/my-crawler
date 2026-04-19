import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: {
    position: "bottom-right",
  },
  transpilePackages: ["@scraping-platform/db", "@scraping-platform/shared"],
};

export default nextConfig;
