import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Keep Next/Turbopack anchored to the frontend app so it does not
  // walk up to the repo root and try to resolve frontend-only deps there.
  outputFileTracingRoot: configDir,
  turbopack: {
    root: configDir,
  },
};

export default nextConfig;
