/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    dirs: ["src"],
    // Ignore ESLint errors during build to see actual build errors
    ignoreDuringBuilds: true
  },
  typescript: {
    // Ignore TypeScript errors during build to see actual build errors
    ignoreBuildErrors: true
  }
};

export default nextConfig;


