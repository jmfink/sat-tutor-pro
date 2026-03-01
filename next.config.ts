import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Lint is run separately; don't block production builds
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
