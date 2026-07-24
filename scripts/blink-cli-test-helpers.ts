/**
 * Shared helpers for spawning the Blink CLI in integration tests.
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { join } from 'node:path'
import { getBlinkPackageRoot, resolveBunExecutable } from './blink-package-root.js'

export const PKG_ROOT = getBlinkPackageRoot()
export const LAUNCHER = join(PKG_ROOT, 'bin', 'blink.js')
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
    BLINK_PACKAGE_ROOT: PKG_ROOT,
    BLINK_SRC: PKG_ROOT,
    BLINK_INVOKE_CWD: extra?.BLINK_INVOKE_CWD ?? PKG_ROOT,
    ...extra,
  }
}

/** Run `node bin/blink.js …` */
export function runLauncher(args: string[], opts: RunOpts = {}): RunResult {
  const env = mergeEnv(opts.env)
  if (args.includes('--quiet') || args.includes('-q')) {
    env.BLINK_QUIET = '1'
  }
  if (args.includes('--json')) {
    env.BLINK_JSON = '1'
  }
  return spawnSync(NODE, [LAUNCHER, ...args], {
    cwd: opts.cwd ?? PKG_ROOT,
    encoding: 'utf8',
    env,
    timeout: opts.timeoutMs ?? 30_000,
  }) as RunResult
}

/** Run `node scripts/<script> …` */
export function runScript(
  scriptName: string,
  args: string[] = [],
  opts: RunOpts = {},
): RunResult {
  const env = mergeEnv(opts.env)
  if (args.includes('--quiet') || args.includes('-q')) {
    env.BLINK_QUIET = '1'
  }
  if (args.includes('--json')) {
    env.BLINK_JSON = '1'
  }
  const script = join(PKG_ROOT, 'scripts', scriptName)
  return spawnSync(NODE, [script, ...args], {
    cwd: opts.cwd ?? PKG_ROOT,
    encoding: 'utf8',
    env,
    timeout: opts.timeoutMs ?? 30_000,
  }) as RunResult
}

/** Run `bun entrypoints/cli.tsx --version` when Bun is available. */
export function runCliVersion(opts: RunOpts = {}): RunResult | null {
  const bun = resolveBunExecutable()
  if (bun === 'bun') {
    try {
      const probe = spawnSync(bun, ['--version'], { encoding: 'utf8', timeout: 5000 })
      if (probe.status !== 0) return null
    } catch {
      return null
    }
  }
  const entry = join(PKG_ROOT, 'entrypoints', 'cli.tsx')
  return spawnSync(bun, [entry, '--version'], {
    cwd: PKG_ROOT,
    encoding: 'utf8',
    env: mergeEnv(opts.env),
    timeout: opts.timeoutMs ?? 60_000,
  }) as RunResult
}

/** Env for an isolated empty home (no ~/.blink). */
export function emptyHomeEnv(dir: string): Record<string, string> {
  return {
    HOME: dir,
    USERPROFILE: dir,
    BLINK_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    ANTHROPIC_AUTH_TOKEN: '',
  }
}

export function combinedOutput(result: RunResult): string {
  return `${result.stdout}\n${result.stderr}`
}
