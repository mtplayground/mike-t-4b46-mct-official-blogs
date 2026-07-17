import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const rustApiBaseUrl = process.env.RUST_API_BASE_URL || "http://127.0.0.1:8081";

    return {
      beforeFiles: [
        {
          source: "/admin/:path*",
          destination: `${rustApiBaseUrl.replace(/\/$/u, "")}/admin/:path*`,
        },
      ],
      fallback: [
        {
          source: "/newsletter",
          destination: `${rustApiBaseUrl.replace(/\/$/u, "")}/newsletter`,
        },
        {
          source: "/sitemap.xml",
          destination: `${rustApiBaseUrl.replace(/\/$/u, "")}/sitemap.xml`,
        },
        {
          source: "/robots.txt",
          destination: `${rustApiBaseUrl.replace(/\/$/u, "")}/robots.txt`,
        },
        {
          source: "/api/:path*",
          destination: `${rustApiBaseUrl.replace(/\/$/u, "")}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
