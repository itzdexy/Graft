#!/usr/bin/env bash
set -euo pipefail

source_path=""
if [[ "${1:-}" == "--source" && -n "${2:-}" ]]; then
  source_path="$2"
elif [[ $# -gt 0 ]]; then
  echo "Usage: bash install.sh [--source /path/to/Graft]" >&2
  exit 2
fi
case "$(uname -s)" in Linux|Darwin) ;; *) echo 'Use install.ps1 on Windows.' >&2; exit 1;; esac
case "$(uname -m)" in x86_64|amd64|aarch64|arm64) ;; *) echo 'Graft requires x64 or ARM64.' >&2; exit 1;; esac
for dependency in node bun; do
  command -v "$dependency" >/dev/null || { echo "Install Node.js 22+ and Bun first: https://nodejs.org and https://bun.sh" >&2; exit 1; }
done
if [[ -z "$source_path" ]]; then
  command -v git >/dev/null || { echo 'Install Git first.' >&2; exit 1; }
  source_path="${GRAFT_INSTALL_ROOT:-$HOME/.local/share/graft}"
  if [[ -e "$source_path" ]]; then
    echo 'Install directory exists. Pull your checkout and rerun with --source /path/to/Graft.' >&2
    exit 1
  fi
  git clone --depth 1 --branch main https://github.com/itzdexy/Graft.git "$source_path"
fi
source_path="$(cd -- "$source_path" && pwd)"
[[ -f "$source_path/bin/graft.js" ]] || { echo 'Not a Graft checkout.' >&2; exit 1; }
(
  cd -- "$source_path"
  bun install --frozen-lockfile --ignore-scripts
  bun scripts/build-graft-runtime.ts
  node scripts/graft-warm.js --force
  node bin/graft.js --version
)
mkdir -p "$HOME/.local/bin"
{
  printf '#!/usr/bin/env bash\n'
  printf 'exec %q %q "$@"\n' "$(command -v node)" "$source_path/bin/graft.js"
} > "$HOME/.local/bin/graft"
chmod 755 "$HOME/.local/bin/graft"
echo 'Installed Graft. Add this to your shell profile if needed:'
echo '  export PATH="$HOME/.local/bin:$PATH"'
echo 'Then run graft from a project folder.'
