/**
 * Launch Blink from source (bun + entrypoints/cli.tsx).
 */
import { spawn } from 'node:child_process'
import { BLINK_PRODUCT_NAME, BLINK_VERSION } from '../constants/blink.js'
import {
  assertBunAvailable,
  getBlinkPackageRoot,
  resolveBlinkCliEntry,
} from './blink-package-root.js'
import { buildBlinkChildAuthEnv, prepareBlinkAuth } from './blink-prep-auth.js'

const TITLE = BLINK_PRODUCT_NAME
const TITLE_REFRESH_MS = 250

const srcRoot = getBlinkPackageRoot()

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      if (signal) {
        resolve({ signal })
        return
      }
      resolve({ code: code ?? 0 })
    })
  })
}

function buildCliArgs(argv) {
  let args = [...argv]
  if (args.includes('--fast')) {
    args = args.filter(a => a !== '--fast')
    if (!args.includes('--bare')) args = ['--bare', ...args]
    return args
  }
  if (args.includes('--bare')) {
    return args
  }
  if (args.includes('--full')) {
    return args.filter(a => a !== '--full')
  }
  return args
}

function blinkChildEnv(argv) {
  const useFast = argv.includes('--fast') || argv.includes('--bare')
  const env = {
    ...process.env,
    BLINK_PACKAGE_ROOT: srcRoot,
    BLINK_SRC: srcRoot,
    BLINK_FORCE_INTERACTIVE: '1',
    CLAUDE_CODE_NO_FLICKER: process.env.CLAUDE_CODE_NO_FLICKER ?? '1',
    ...(process.platform === 'win32'
      ? { BLINK_SKIP_TERMINAL_QUERIES: '1' }
      : {}),
  }
  if (useFast) {
    env.CLAUDE_CODE_SIMPLE = '1'
  }
  return env
}

// Opt-in startup timing: set BLINK_PROFILE=1 to print phase durations to stderr.
const PROFILE = process.env.BLINK_PROFILE === '1' || process.env.BLINK_PROFILE === 'true'
function mark(label, since) {
  if (!PROFILE) return
  const ms = Math.round(Number(process.hrtime.bigint() - since) / 1e6)
  process.stderr.write(`[blink:profile] ${label}: ${ms}ms\n`)
}

async function main() {
  const t0 = process.hrtime.bigint()
  const args = process.argv.slice(2)
  const versionOnly =
    args.length === 1 && (args[0] === '--version' || args[0] === '-v')

  if (versionOnly) {
    process.title = TITLE
    console.log(`${BLINK_VERSION} (${BLINK_PRODUCT_NAME})`)
    process.exit(0)
  }

  const cliEntry = resolveBlinkCliEntry(srcRoot)
  if (!cliEntry) {
    console.error('blink-run: entrypoints/cli.tsx not found')
    process.exit(1)
  }

  const bunCmd = assertBunAvailable()

  // Prep auth in-process. This was previously a separate Node subprocess
  // (spawn of blink-prep-auth.js) on every launch — pure overhead, since this
  // module is already loaded in-process for buildBlinkChildAuthEnv() below.
  // prepareBlinkAuth() prints a help message and exits(1) if no valid key.
  try {
    prepareBlinkAuth()
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
  mark('prep-auth', t0)

  const cliArgs = buildCliArgs(args)
  const childEnv = {
    ...blinkChildEnv(args),
    ...buildBlinkChildAuthEnv(),
  }
  delete childEnv.CLAUDE_CODE_OAUTH_TOKEN

  process.title = TITLE
  const titleTimer =
    process.platform === 'win32'
      ? setInterval(() => {
          process.title = TITLE
        }, TITLE_REFRESH_MS)
      : null

  mark('launcher-total', t0)
  const child = spawn(bunCmd, [cliEntry, ...cliArgs], {
    cwd: srcRoot,
    stdio: 'inherit',
    env: childEnv,
  })

  try {
    const result = await waitForChild(child)
    if (titleTimer) clearInterval(titleTimer)
    if ('signal' in result && result.signal) {
      process.kill(process.pid, result.signal)
      return
    }
    process.exit(result.code ?? 0)
  } catch (err) {
    if (titleTimer) clearInterval(titleTimer)
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

await main()
