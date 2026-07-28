/**
 * Shared helpers for spawning the Tovyr CLI in integration tests.
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { join } from 'node:path'
import { getTovyrPackageRoot, resolveBunExecutable } from './tovyr-package-root.js'

export const PKG_ROOT = getTovyrPackageRoot()
export const LAUNCHER = join(PKG_ROOT, 'bin', 'tovyr.js')
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
    TOVYR_PACKAGE_ROOT: PKG_ROOT,
    TOVYR_SRC: PKG_ROOT,
    TOVYR_INVOKE_CWD: extra?.TOVYR_INVOKE_CWD ?? PKG_ROOT,
    ...extra,
  }
}

/** Run `node bin/tovyr.js …` */
export function runLauncher(args: string[], opts: RunOpts = {}): RunResult {
  const env = mergeEnv(opts.env)
  if (args.includes('--quiet') || args.includes('-q')) {
    env.TOVYR_QUIET = '1'
  }
  if (args.includes('--json')) {
    env.TOVYR_JSON = '1'
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
    env.TOVYR_QUIET = '1'
  }
  if (args.includes('--json')) {
    env.TOVYR_JSON = '1'
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

/** Env for an isolated empty home (no ~/.tovyr). */
export function emptyHomeEnv(dir: string): Record<string, string> {
  return {
    HOME: dir,
    USERPROFILE: dir,
    TOVYR_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    ANTHROPIC_AUTH_TOKEN: '',
  }
}

export function combinedOutput(result: RunResult): string {
  return `${result.stdout}\n${result.stderr}`
}
