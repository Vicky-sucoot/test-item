import type { NextConfig } from "next";
import os from "node:os";

// 允許手機以區網 IP 連線開發伺服器（npm run lan）
const lanHosts = Object.values(os.networkInterfaces())
  .flatMap((list) => list ?? [])
  .filter((a) => a.family === "IPv4" && !a.internal)
  .map((a) => a.address);

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  allowedDevOrigins: lanHosts,
  // 不自動產生 AGENTS.md
  agentRules: false,
  experimental: {
    serverActions: { bodySizeLimit: "30mb" },
  },
};

export default nextConfig;
