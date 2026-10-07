import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['motion', 'motion-dom', 'framer-motion', '@enterprise-hms/ui'],
  devIndicators: {
    position: 'bottom-right',
  },
};

export default nextConfig;
