/**
 * Launch Graft from source (bun + src/entrypoints/cli.tsx).
 */
import { spawn } from 'node:child_process'
import { GRAFT_PRODUCT_NAME, GRAFT_VERSION } from '../src/constants/graft.js'
import {
  assertBunAvailable,
  getGraftPackageRoot,
  resolveGraftCliEntry,
} from './graft-package-root.js'
import { buildGraftChildAuthEnv, prepareGraftAuth } from './graft-prep-auth.js'

const TITLE = GRAFT_PRODUCT_NAME
const TITLE_REFRESH_MS = 250

const srcRoot = getGraftPackageRoot()

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

function graftChildEnv(argv) {
  const useFast = argv.includes('--fast') || argv.includes('--bare')
  const env = {
    ...process.env,
    GRAFT_PACKAGE_ROOT: srcRoot,
    GRAFT_SRC: srcRoot,
    GRAFT_FORCE_INTERACTIVE: '1',
    GRAFT_CODE_NO_FLICKER: process.env.GRAFT_CODE_NO_FLICKER ?? '1',
    ...(process.platform === 'win32'
      ? { GRAFT_SKIP_TERMINAL_QUERIES: '1' }
      : {}),
  }
  if (useFast) {
    env.GRAFT_CODE_SIMPLE = '1'
  }
  return env
}

// Opt-in startup timing: set GRAFT_PROFILE=1 to print phase durations to stderr.
const PROFILE = process.env.GRAFT_PROFILE === '1' || process.env.GRAFT_PROFILE === 'true'
function mark(label, since) {
  if (!PROFILE) return
  const ms = Math.round(Number(process.hrtime.bigint() - since) / 1e6)
  process.stderr.write(`[graft:profile] ${label}: ${ms}ms\n`)
}

async function main() {
  const t0 = process.hrtime.bigint()
  const args = process.argv.slice(2)
  const versionOnly =
    args.length === 1 && (args[0] === '--version' || args[0] === '-v')

  if (versionOnly) {
    process.title = TITLE
    console.log(`${GRAFT_VERSION} (${GRAFT_PRODUCT_NAME})`)
    process.exit(0)
  }

  const cliEntry = resolveGraftCliEntry(srcRoot)
  if (!cliEntry) {
    console.error('graft-run: src/entrypoints/cli.tsx not found')
    process.exit(1)
  }

  const bunCmd = assertBunAvailable()

  // Prep auth in-process. This was previously a separate Node subprocess
  // (spawn of graft-prep-auth.js) on every launch — pure overhead, since this
  // module is already loaded in-process for buildGraftChildAuthEnv() below.
  // prepareGraftAuth() prints a help message and exits(1) if no valid key.
  try {
    prepareGraftAuth()
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
  mark('prep-auth', t0)

  const cliArgs = buildCliArgs(args)
  const childEnv = {
    ...graftChildEnv(args),
    ...buildGraftChildAuthEnv(),
  }
  delete childEnv.GRAFT_CODE_OAUTH_TOKEN

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
