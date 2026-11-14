import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // TypeScript errors fail the build — type safety is enforced, not ignored.
  reactStrictMode: false,
};

export default nextConfig;
