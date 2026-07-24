/**
 * Blink Warm Compile Cache
 *
 * Pre-compiles heavy UI modules so interactive `blink` starts with a working TUI.
 * Reduces first-launch time from 1-3 minutes to <5 seconds on subsequent runs.
 *
 * Uses file fingerprinting (SHA256 of main.tsx, cli.tsx, package.json) to detect
 * when recompilation is needed. Cache stored in .cache/blink-warm.stamp.
 *
 * Run automatically before first launch, after updates, or manually via:
 *   npm run warm
 *   blink --warm-cache --force
 *
 * @module scripts/blink-warm
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

import { resolveBunExecutable, getBlinkPackageRoot } from './blink-package-root.js'

const root = getBlinkPackageRoot()
const bun = resolveBunExecutable()
const cacheDir = join(root, '.cache')
const stampPath = join(cacheDir, 'blink-warm.stamp')

function warmFingerprint() {
  // Only invalidate on core entry / package changes — not every UI tweak.
  // Bun's module cache still compiles changed files; this stamp just skips
  // a full multi-minute re-warm on every dock/theme edit.
  const files = [
    'main.tsx',
    'entrypoints/cli.tsx',
    'package.json',
  ]
  const hash = createHash('sha256')
  for (const rel of files) {
    const path = join(root, rel)
    if (existsSync(path)) {
      hash.update(rel)
      hash.update(String(statSync(path).mtimeMs))
    }
  }
  return hash.digest('hex').slice(0, 16)
}

export function blinkWarmNeeded() {
  if (!existsSync(join(root, 'entrypoints', 'cli.tsx'))) return false
  if (process.env.BLINK_SKIP_WARM === '1') return false
  const fp = warmFingerprint()
  if (!existsSync(stampPath)) return true
  try {
    return readFileSync(stampPath, 'utf8').trim() !== fp
  } catch {
    return true
  }
}

function writeWarmStamp() {
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(stampPath, warmFingerprint(), 'utf8')
}

export function runBlinkWarm({ force = false } = {}) {
  if (!force && !blinkWarmNeeded()) {
    return Promise.resolve(0)
  }

  const cliEntry = join(root, 'entrypoints', 'cli.tsx')
  if (!existsSync(cliEntry)) {
    return Promise.resolve(0)
  }

  return new Promise((resolve) => {
    const child = spawn(bun, [cliEntry, '--bare', '--warm-cache'], {
      cwd: root,
      // Pipe stdout so a parent PowerShell session does not repaint its prompt
      // when the warm child exits (stdio inherit shares the console with PSReadLine).
      stdio: ['ignore', 'pipe', 'inherit'],
      env: {
        ...process.env,
        BLINK_PACKAGE_ROOT: root,
        BLINK_SRC: root,
        BLINK_WARM_QUIET_LOADER: '1',
        CLAUDE_CODE_SIMPLE: '1',
        // Never inherit interactive mode into warm — stdin.ref() prevents exit
        // and hangs the parent forever on the compiling screen.
        BLINK_FORCE_INTERACTIVE: '0',
      },
    })
    child.stdout?.on('data', () => {})
    child.on('exit', (code) => {
      if ((code ?? 1) === 0) writeWarmStamp()
      resolve(code ?? 1)
    })
  })
}

const isWarmCli =
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url

if (isWarmCli) {
  const force = process.argv.includes('--force')
  const code = await runBlinkWarm({ force })
  process.exit(code)
}
