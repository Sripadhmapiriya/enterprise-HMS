import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['motion', 'motion-dom', 'framer-motion', '@enterprise-hms/ui'],
  devIndicators: {
    position: 'bottom-right',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/api/:path*',
      },
    ];
  },
};

export default nextConfig;
