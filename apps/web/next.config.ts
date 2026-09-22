import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Isolate review builds from the directory read by the running host.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  transpilePackages: ["@gap402/protocol", "@gap402/schemas"],
  webpack(config) {
    // Workspace packages use NodeNext .js specifiers while exporting TS source.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
