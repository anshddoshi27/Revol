/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors. Only use this if you need to debug build issues.
    ignoreDuringBuilds: true,
    dirs: ["src"]
  },
  typescript: {
    // Warning: This allows production builds to successfully complete even if
    // your project has type errors. Only use this if you need to debug build issues.
    ignoreBuildErrors: false
  }
};

export default nextConfig;


