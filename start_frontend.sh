#!/usr/bin/env bash
set -euo pipefail

# Next.js 15.5+ removed the `--webpack` CLI flag. Always use plain `next dev`.
cd "$(dirname "$0")/frontend"
exec npx next dev "$@"
