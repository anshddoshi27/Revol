/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    reactCompiler: true
  },
  eslint: {
    dirs: ["src"]
  },
  output: 'standalone',
};

export default nextConfig;


