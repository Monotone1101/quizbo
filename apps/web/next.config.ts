import path from "node:path";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// `next` always runs from apps/web; one .env at the repo root serves every app locally.
// Next has already loaded (and cached) env for apps/web by now, so force a reload from the root.
// Variables already set in the real environment still win.
const repoRoot = path.resolve(process.cwd(), "../..");
loadEnvConfig(repoRoot, process.env.NODE_ENV !== "production", undefined, true);

const nextConfig: NextConfig = {
  // Docker images use the standalone server; Vercel ignores this.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  outputFileTracingRoot: repoRoot,
  transpilePackages: ["@quizbo/core", "@quizbo/db", "@quizbo/ai"],
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  experimental: {
    // Coach uploads (PDF/text notes) go through a route handler capped at 4 MB.
    serverActions: { bodySizeLimit: "2mb" },
  },
  poweredByHeader: false,
};

export default nextConfig;
