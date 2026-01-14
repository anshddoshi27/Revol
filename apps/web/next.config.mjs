/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: true
  },
  eslint: {
    dirs: ["src"]
  }
};

export default nextConfig;


