#!/usr/bin/env bash
# Install Bun (if missing) and warm-compile Tovyr on macOS / Linux.
set -euo pipefail

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
cd "$ROOT"

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64|aarch64|arm64) ;;
  i386|i486|i586|i686|x86)
    echo "Tovyr cannot run on 32-bit x86: Bun does not publish an ia32 runtime." >&2
    exit 1
    ;;
  *)
    echo "Unsupported CPU architecture: $ARCH (Tovyr supports x64 and ARM64)." >&2
    exit 1
    ;;
esac

if [[ -n "${TERMUX_VERSION:-}" || "${PREFIX:-}" == *com.termux* ]]; then
  if ! command -v patchelf >/dev/null 2>&1; then
    echo "Termux needs its glibc compatibility layer first:" >&2
    echo "  pkg install glibc patchelf" >&2
    exit 1
  fi
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "Bun not found — installing (https://bun.sh)..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="${HOME}/.bun/bin:${PATH}"
fi

echo "Installing dependencies..."
bun install

echo "Warming UI compile..."
bun run build

echo ""
echo "Done. Add Bun to PATH if needed:"
echo "  export PATH=\"\$HOME/.bun/bin:\$PATH\""
echo ""
echo "Then:"
echo "  tovyr auth login --key <your_key>"
echo "  tovyr"
