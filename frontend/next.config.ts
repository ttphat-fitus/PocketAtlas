import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  output: 'standalone',
  webpack: (config, { isServer }) => {
    return config;
  },
};

export default nextConfig;
