import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    reactCompiler: true
  },
  eslint: {
    dirs: ["src"]
  }
};

export default nextConfig;

