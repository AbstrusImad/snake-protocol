import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.100.12", "192.168.100.*", "localhost"],
};

export default nextConfig;
