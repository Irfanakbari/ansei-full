import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  basePath: '/ansei',
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  allowedDevOrigins: ['10.10.10.53']
};

export default nextConfig;
