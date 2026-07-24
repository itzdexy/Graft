#!/usr/bin/env bash
# Install Bun (if missing) and warm-compile Blink on macOS / Linux.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun not found — installing (https://bun.sh)..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="${HOME}/.bun/bin:${PATH}"
fi

echo "Installing npm dependencies..."
npm install

echo "Warming UI compile..."
npm run build

echo ""
echo "Done. Add Bun to PATH if needed:"
echo "  export PATH=\"\$HOME/.bun/bin:\$PATH\""
echo ""
echo "Then:"
echo "  blink auth login --key <your_key>"
echo "  blink"
