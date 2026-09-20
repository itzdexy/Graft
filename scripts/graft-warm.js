/**
 * Graft Warm Compile Cache
 *
 * Bundles the standalone source graph into a split Bun runtime cache so the
 * interactive CLI avoids reloading thousands of source modules per client.
 *
 * Uses file fingerprinting (SHA256 of main.tsx, cli.tsx, package.json) to detect
 * when regeneration is needed. Cache stored under .cache/runtime.
 *
 * Run automatically before first launch, after updates, or manually via:
 *   npm run warm
 *   graft --warm-cache --force
 *
 * @module scripts/graft-warm
 */

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { join } from 'node:path'

import { resolveBunExecutable, getGraftPackageRoot } from './graft-package-root.js'
import {
  startGraftStartupLoader,
  stopGraftStartupLoader,
} from './graft-startup-loader.js'

const root = getGraftPackageRoot()
const bun = resolveBunExecutable()
const cacheDir = join(root, '.cache')
const stampPath = join(cacheDir, 'graft-warm.stamp')
const runtimeEntry = join(cacheDir, 'runtime', 'graft-cli.js')
const WARM_CACHE_VERSION = '5'

function walkMaxMtime(dir, depth, maxDepth, hash) {
  if (depth > maxDepth || !existsSync(dir)) return
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.cache' || entry.name.startsWith('.')) {
      continue
    }
    const full = join(dir, entry.name)
    try {
      if (entry.isDirectory()) {
        walkMaxMtime(full, depth + 1, maxDepth, hash)
      } else if (entry.isFile() && /\.(tsx?|jsx?|json)$/.test(entry.name)) {
        hash.update(full)
        hash.update(String(statSync(full).mtimeMs))
      }
    } catch {
      // ignore unreadable entries
    }
  }
}

/**
 * A launch calls graftWarmNeeded() up to three times (launcher gate, runGraftWarm,
 * then getGraftRuntimeEntry), each re-walking ~430 source files. Source cannot
 * change mid-launch, so the digest is computed once per process.
 * @type {string | null}
 */
let cachedFingerprint = null

/** Drops the memo so a rebuild in this process re-reads mtimes. */
function resetWarmFingerprint() {
  cachedFingerprint = null
}

function warmFingerprint() {
  if (cachedFingerprint !== null) return cachedFingerprint
  cachedFingerprint = computeWarmFingerprint()
  return cachedFingerprint
}

function computeWarmFingerprint() {
  // Invalidate when core entries or deep product sources change so
  // `.cache/runtime/graft-cli.js` cannot silently serve a stale graph.
  const files = [
    'src/main.tsx',
    'src/entrypoints/cli.tsx',
    'src/build/preload.ts',
    'bunfig.toml',
    'package.json',
    'scripts/build-graft-runtime.ts',
  ]
  const hash = createHash('sha256')
  hash.update(WARM_CACHE_VERSION)
  for (const rel of files) {
    const path = join(root, rel)
    if (existsSync(path)) {
      hash.update(rel)
      hash.update(String(statSync(path).mtimeMs))
    }
  }
  for (const relDir of ['src/entrypoints', 'src/screens', 'src/services/graft', 'src/components/graft', 'src/query.ts']) {
    const path = join(root, relDir)
    if (existsSync(path) && statSync(path).isFile()) {
      hash.update(relDir)
      hash.update(String(statSync(path).mtimeMs))
    } else {
      walkMaxMtime(path, 0, 5, hash)
    }
  }
  return hash.digest('hex').slice(0, 16)
}

export function graftWarmNeeded() {
  if (!existsSync(join(root, 'src', 'entrypoints', 'cli.tsx'))) return false
  if (process.env.GRAFT_SKIP_WARM === '1') return false
  if (!existsSync(runtimeEntry)) return true
  const fp = warmFingerprint()
  if (!existsSync(stampPath)) return true
  try {
    return readFileSync(stampPath, 'utf8').trim() !== fp
  } catch {
    return true
  }
}

export function getGraftRuntimeEntry() {
  return existsSync(runtimeEntry) && !graftWarmNeeded()
    ? runtimeEntry
    : undefined
}

function writeWarmStamp() {
  mkdirSync(cacheDir, { recursive: true })
  // Recompute after the build: a source edit made while the build ran must not
  // be stamped as already-compiled, or the stale bundle is served until the
  // next edit. Only the rebuild path pays for this walk.
  resetWarmFingerprint()
  writeFileSync(stampPath, warmFingerprint(), 'utf8')
}

export function runGraftWarm({ force = false } = {}) {
  if (!force && !graftWarmNeeded()) {
    return Promise.resolve(0)
  }

  const buildEntry = join(root, 'scripts', 'build-graft-runtime.ts')
  if (!existsSync(buildEntry)) {
    return Promise.resolve(0)
  }

  return new Promise((resolve) => {
    const child = spawn(bun, [buildEntry], {
      cwd: root,
      // Pipe stdout so a parent PowerShell session does not repaint its prompt
      // when the warm child exits (stdio inherit shares the console with PSReadLine).
      stdio: ['ignore', 'pipe', 'inherit'],
      env: {
        ...process.env,
        GRAFT_PACKAGE_ROOT: root,
        GRAFT_SRC: root,
        GRAFT_WARM_QUIET_LOADER: '1',
        GRAFT_CODE_SIMPLE: '1',
        NODE_ENV: 'production',
        // Never inherit interactive mode into warm — stdin.ref() prevents exit
        // and hangs the parent forever on the compiling screen.
        GRAFT_FORCE_INTERACTIVE: '0',
      },
    })
    child.stdout?.on('data', () => {})
    child.on('error', (error) => {
      console.error(`Graft warm-up could not start Bun: ${error.message}`)
      resolve(1)
    })
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
  startGraftStartupLoader('compile')
  try {
    const code = await runGraftWarm({ force })
    stopGraftStartupLoader()
    process.exit(code)
  } catch (error) {
    stopGraftStartupLoader()
    throw error
  }
}
