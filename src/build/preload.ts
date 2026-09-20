import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GRAFT_VERSION } from '../constants/graft.js'
import { feature } from '../utils/features.js'

// â”€â”€ Shell-independent Graft runtime bootstrap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Every launcher funnels through this Bun preload: the bash `graft` script,
// `graft.ps1` (PowerShell), `graft.cmd` (cmd.exe), the `graft.js` npm entry,
// Git Bash / MSYS, WSL, and even running `bun src/entrypoints/cli.tsx` directly.
// Each launcher sets the Graft env vars on its own, but a shell that bypasses
// a launcher (or a launcher that returns early) would otherwise lose Graft
// runtime detection and the resize-safe alt-screen renderer. Deriving the
// values here â€” from this file's own location â€” guarantees identical behavior
// in every shell. We only fill values that are missing, so an explicit
// launcher value or user opt-out always wins.
try {
  // src/build/preload.ts -> parent of src/ is the package root.
  const GRAFT_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
  if (!process.env.GRAFT_PACKAGE_ROOT) process.env.GRAFT_PACKAGE_ROOT = GRAFT_ROOT
  if (!process.env.GRAFT_SRC) process.env.GRAFT_SRC = GRAFT_ROOT
  // Graft is an end-user CLI even when launched from the source checkout.
  // React/Ink otherwise select their development builds, adding expensive
  // validation and devtools work to every process. Preserve explicit values
  // so contributors can still opt into development diagnostics.
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production'
  // Alt-screen renderer (GRAFT_CODE_NO_FLICKER=1): main-screen redraw leaves
  // ghost frames on window resize, especially on Windows. Default it on unless
  // the user explicitly set it (including an explicit "0" opt-out).
  const noFlicker = process.env.GRAFT_CODE_NO_FLICKER
  if (noFlicker == null || noFlicker === '') {
    process.env.GRAFT_CODE_NO_FLICKER = '1'
  }

  // Graft-named credentials. Users configure Graft, so they reasonably expect
  // GRAFT_AUTH_TOKEN rather than a variable named for a different vendor.
  // These are aliases, not a rename: the Anthropic SDK and the OpenAI-compat
  // proxy read the ANTHROPIC_* names downstream, and 17 files depend on them.
  // Mapping here — before any of that loads — lets the Graft name be the one
  // users write while the plumbing underneath is untouched.
  //
  // A Graft name always wins when set: it is the more specific choice, and a
  // stale ANTHROPIC_* left over in a shell profile should not quietly beat the
  // value the user just set.
  for (const [graftName, anthropicName] of [
    ['GRAFT_AUTH_TOKEN', 'ANTHROPIC_AUTH_TOKEN'],
    ['GRAFT_API_KEY', 'ANTHROPIC_API_KEY'],
    ['GRAFT_BASE_URL', 'ANTHROPIC_BASE_URL'],
    ['GRAFT_MODEL', 'ANTHROPIC_MODEL'],
  ] as const) {
    const value = process.env[graftName]
    if (value != null && value !== '') {
      process.env[anthropicName] = value
    }
  }
} catch {
  // Never let env bootstrap break startup.
}

;(globalThis as typeof globalThis & { MACRO: Record<string, string> }).MACRO = {
  VERSION: GRAFT_VERSION,
  PACKAGE_URL: 'graftcode',
  ISSUES_EXPLAINER: 'open an issue in the GraftCode repository',
}

;(globalThis as typeof globalThis & { feature: typeof feature }).feature = feature
