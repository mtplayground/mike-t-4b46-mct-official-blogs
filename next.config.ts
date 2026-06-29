import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const rustApiBaseUrl = process.env.RUST_API_BASE_URL || "http://127.0.0.1:8081";

    return {
      fallback: [
        {
          source: "/api/:path*",
          destination: `${rustApiBaseUrl.replace(/\/$/u, "")}/api/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;
