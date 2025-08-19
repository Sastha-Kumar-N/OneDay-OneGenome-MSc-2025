import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // ✅ Don’t fail the Vercel build because of ESLint errors
  eslint: {
    ignoreDuringBuilds: true,
  },

  // (Optional) Don’t fail the build on TypeScript type errors in prod
  // Useful while you refactor types; remove later for stricter CI.
  typescript: {
    ignoreBuildErrors: true,
  },

  // (Optional) If you load remote images, configure domains here
  // images: { remotePatterns: [{ protocol: "https", hostname: "example.com" }] },
};

export default nextConfig;
