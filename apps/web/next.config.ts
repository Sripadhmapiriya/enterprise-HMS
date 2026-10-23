import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import type { NextConfig } from "next";

const rootEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

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
