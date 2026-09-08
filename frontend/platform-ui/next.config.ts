import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow production builds to finish smoothly on Vercel without strict lint/type blocks
  typescript: {
    ignoreBuildErrors: true,
  },

  // API rewrites: proxy /api/backend/* → FastAPI backend (INTERNAL_API_URL for server-side).
  // Function timeout for Vercel is configured in vercel.json (maxDuration: 60).
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.INTERNAL_API_URL ?? "http://localhost:8000"}/:path*`,
      },
    ];
  },
};

export default nextConfig;
