import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  devIndicators: false,
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
