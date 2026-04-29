import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const distDir = path.join(process.cwd(), ".next");

// Deletes `.next`. Run via `npm run clean` after a crashed dev server or weird ENOENT
// errors — do NOT run this automatically before `next dev` (that races with requests).
if (existsSync(distDir)) {
  rmSync(distDir, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 150,
  });
}
