import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Keep Next/Turbopack anchored to the frontend app so it does not
  // walk up to the repo root and try to resolve frontend-only deps there.
  outputFileTracingRoot: configDir,
  experimental: {
    // Next 15's segment explorer can crash in dev with React manifest errors
    // in this workspace layout, so disable it until the upstream bug is fixed.
    devtoolSegmentExplorer: false,
  },
  turbopack: {
    root: configDir,
  },
};

export default nextConfig;
