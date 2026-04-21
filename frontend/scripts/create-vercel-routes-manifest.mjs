import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const source = join(process.cwd(), ".next", "routes-manifest.json");
const destination = join(process.cwd(), ".next", "routes-manifest-deterministic.json");
const deadline = Date.now() + 120_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

while (Date.now() < deadline) {
  mkdirSync(join(process.cwd(), ".next"), { recursive: true });

  if (existsSync(source)) {
    // Vercel CLI 51 currently asks for this deterministic manifest during its
    // Next build hook, before a post-build shell command can create it.
    for (let i = 0; i < 160; i += 1) {
      if (existsSync(source)) {
        copyFileSync(source, destination);
      }
      await sleep(250);
    }
    process.exit(0);
  }

  if (!existsSync(destination)) {
    writeFileSync(destination, "{}\n");
  }

  await sleep(100);
}

process.exit(0);
