import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TOVYR_VERSION } from '../constants/tovyr.js'
import { feature } from './feature-shim.js'

// â”€â”€ Shell-independent Tovyr runtime bootstrap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Every launcher funnels through this Bun preload: the bash `tovyr` script,
// `tovyr.ps1` (PowerShell), `tovyr.cmd` (cmd.exe), the `tovyr.js` npm entry,
// Git Bash / MSYS, WSL, and even running `bun entrypoints/cli.tsx` directly.
// Each launcher sets the Tovyr env vars on its own, but a shell that bypasses
// a launcher (or a launcher that returns early) would otherwise lose Tovyr
// runtime detection and the resize-safe alt-screen renderer. Deriving the
// values here â€” from this file's own location â€” guarantees identical behavior
// in every shell. We only fill values that are missing, so an explicit
// launcher value or user opt-out always wins.
try {
  // build/preload.ts â†’ parent of build/ is the package root.
  const TOVYR_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
  if (!process.env.TOVYR_PACKAGE_ROOT) process.env.TOVYR_PACKAGE_ROOT = TOVYR_ROOT
  if (!process.env.TOVYR_SRC) process.env.TOVYR_SRC = TOVYR_ROOT
  // Tovyr is an end-user CLI even when launched from the source checkout.
  // React/Ink otherwise select their development builds, adding expensive
  // validation and devtools work to every process. Preserve explicit values
  // so contributors can still opt into development diagnostics.
  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'production'
  // Alt-screen renderer (TOVYR_CODE_NO_FLICKER=1): main-screen redraw leaves
  // ghost frames on window resize, especially on Windows. Default it on unless
  // the user explicitly set it (including an explicit "0" opt-out).
  const noFlicker = process.env.TOVYR_CODE_NO_FLICKER
  if (noFlicker == null || noFlicker === '') {
    process.env.TOVYR_CODE_NO_FLICKER = '1'
  }

  // Tovyr-named credentials. Users configure Tovyr, so they reasonably expect
  // TOVYR_AUTH_TOKEN rather than a variable named for a different vendor.
  // These are aliases, not a rename: the Anthropic SDK and the OpenAI-compat
  // proxy read the ANTHROPIC_* names downstream, and 17 files depend on them.
  // Mapping here — before any of that loads — lets the Tovyr name be the one
  // users write while the plumbing underneath is untouched.
  //
  // A Tovyr name always wins when set: it is the more specific choice, and a
  // stale ANTHROPIC_* left over in a shell profile should not quietly beat the
  // value the user just set.
  for (const [tovyrName, anthropicName] of [
    ['TOVYR_AUTH_TOKEN', 'ANTHROPIC_AUTH_TOKEN'],
    ['TOVYR_API_KEY', 'ANTHROPIC_API_KEY'],
    ['TOVYR_BASE_URL', 'ANTHROPIC_BASE_URL'],
    ['TOVYR_MODEL', 'ANTHROPIC_MODEL'],
  ] as const) {
    const value = process.env[tovyrName]
    if (value != null && value !== '') {
      process.env[anthropicName] = value
    }
  }
} catch {
  // Never let env bootstrap break startup.
}

;(globalThis as typeof globalThis & { MACRO: Record<string, string> }).MACRO = {
  VERSION: TOVYR_VERSION,
  PACKAGE_URL: 'tovyrcode',
  ISSUES_EXPLAINER: 'open an issue in the TovyrCode repository',
}

;(globalThis as typeof globalThis & { feature: typeof feature }).feature = feature
