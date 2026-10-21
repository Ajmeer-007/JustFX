/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Prevents double mounting in dev for charting canvases
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs']
  }
};

export default nextConfig;
