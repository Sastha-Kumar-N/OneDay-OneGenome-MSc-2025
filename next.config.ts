import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ✅ Don’t fail builds on ESLint errors
  eslint: {
    ignoreDuringBuilds: true,
  },

  // (optional) Don’t fail builds on TS type errors (remove later for strict CI)
  typescript: {
    ignoreBuildErrors: true,
  },

  // (optional) Add remote image domains here if you use next/image
  // images: { remotePatterns: [{ protocol: "https", hostname: "example.com" }] },
};

export default nextConfig;
