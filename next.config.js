/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Cloudflare Pages configuration
  images: {
    unoptimized: true, // Cloudflare Images not configured yet
  },

  // ESM for better edge compatibility
  transpilePackages: ['drizzle-orm'],
}

module.exports = nextConfig
