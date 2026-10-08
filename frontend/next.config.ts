import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable the dev-mode route/build indicator panel.
  // It never appears in production builds regardless.
  devIndicators: false,
};

export default nextConfig;
