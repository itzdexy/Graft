/**
 * Shared helpers for spawning the Graft CLI in integration tests.
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { join } from 'node:path'
import { getGraftPackageRoot, resolveBunExecutable } from './graft-package-root.js'
import { createGraftTestHome } from './graft-test-home.js'

export const PKG_ROOT = getGraftPackageRoot()
export const LAUNCHER = join(PKG_ROOT, 'bin', 'graft.js')
export const NODE = process.execPath

export type RunResult = SpawnSyncReturns<string> & {
  stdout: string
  stderr: string
}

export type RunOpts = {
  env?: Record<string, string>
  cwd?: string
  timeoutMs?: number
}

function mergeEnv(extra?: Record<string, string>): NodeJS.ProcessEnv {
  return {
    ...process.env,
    GRAFT_PACKAGE_ROOT: PKG_ROOT,
    GRAFT_SRC: PKG_ROOT,
    GRAFT_INVOKE_CWD: extra?.GRAFT_INVOKE_CWD ?? PKG_ROOT,
    ...extra,
  }
}

/** Run `node bin/graft.js …` */
export function runLauncher(args: string[], opts: RunOpts = {}): RunResult {
  const testHome = opts.env?.HOME || opts.env?.USERPROFILE || opts.env?.GRAFT_HOME
    ? null
    : createGraftTestHome()
  const env = mergeEnv({ ...testHome?.env, ...opts.env })
  if (args.includes('--quiet') || args.includes('-q')) {
    env.GRAFT_QUIET = '1'
  }
  if (args.includes('--json')) {
    env.GRAFT_JSON = '1'
  }
  try {
    return spawnSync(NODE, [LAUNCHER, ...args], {
      cwd: opts.cwd ?? PKG_ROOT,
      encoding: 'utf8',
      env,
      timeout: opts.timeoutMs ?? 30_000,
    }) as RunResult
  } finally {
    testHome?.cleanup()
  }
}

/** Run `node scripts/<script> …` */
export function runScript(
  scriptName: string,
  args: string[] = [],
  opts: RunOpts = {},
): RunResult {
  const testHome = opts.env?.HOME || opts.env?.USERPROFILE || opts.env?.GRAFT_HOME
    ? null
    : createGraftTestHome()
  const env = mergeEnv({ ...testHome?.env, ...opts.env })
  if (args.includes('--quiet') || args.includes('-q')) {
    env.GRAFT_QUIET = '1'
  }
  if (args.includes('--json')) {
    env.GRAFT_JSON = '1'
  }
  const script = join(PKG_ROOT, 'scripts', scriptName)
  try {
    return spawnSync(NODE, [script, ...args], {
      cwd: opts.cwd ?? PKG_ROOT,
      encoding: 'utf8',
      env,
      timeout: opts.timeoutMs ?? 30_000,
    }) as RunResult
  } finally {
    testHome?.cleanup()
  }
}

/** Run `bun src/entrypoints/cli.tsx --version` when Bun is available. */
export function runCliVersion(opts: RunOpts = {}): RunResult | null {
  const testHome = opts.env?.HOME || opts.env?.USERPROFILE || opts.env?.GRAFT_HOME
    ? null
    : createGraftTestHome()
  try {
    const bun = resolveBunExecutable()
    if (bun === 'bun') {
      try {
        const probe = spawnSync(bun, ['--version'], { encoding: 'utf8', timeout: 5000 })
        if (probe.status !== 0) return null
      } catch {
        return null
      }
    }
    const entry = join(PKG_ROOT, 'src', 'entrypoints', 'cli.tsx')
    return spawnSync(bun, [entry, '--version'], {
      cwd: PKG_ROOT,
      encoding: 'utf8',
      env: mergeEnv({ ...testHome?.env, ...opts.env }),
      timeout: opts.timeoutMs ?? 60_000,
    }) as RunResult
  } finally {
    testHome?.cleanup()
  }
}

/** Env for an isolated empty home (no ~/.graft). */
export function emptyHomeEnv(dir: string): Record<string, string> {
  return {
    HOME: dir,
    USERPROFILE: dir,
    GRAFT_HOME: dir,
    GRAFT_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    ANTHROPIC_AUTH_TOKEN: '',
  }
}

export function combinedOutput(result: RunResult): string {
  return `${result.stdout}\n${result.stderr}`
}
