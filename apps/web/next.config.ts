import type { NextConfig } from "next";
import path from "node:path";

const basePath = "/ansei";

const nextConfig: NextConfig = {
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
    DEMO: process.env.DEMO ?? "",
    NEXT_PUBLIC_DEMO: process.env.NEXT_PUBLIC_DEMO ?? process.env.DEMO ?? "",
  },
  output: 'standalone',
  outputFileTracingRoot: path.resolve(process.cwd(), '../..'),
  turbopack: {
    root: path.resolve(process.cwd(), "../.."),
  },
  allowedDevOrigins: ['10.10.10.53']
};

export default nextConfig;
