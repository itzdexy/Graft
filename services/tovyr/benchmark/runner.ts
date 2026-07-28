import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { TOVYR_VERSION } from '../../../constants/tovyr.js'
import { getTovyrPackageRoot, resolveBunExecutable } from '../../../scripts/tovyr-package-root.js'
import { resolveActive } from '../../../scripts/tovyr-providers.js'
import { scanProject } from '../context/projectScan.js'
import { matchSecretPath } from '../permissions/secretPaths.js'
import { matchDestructiveShellCommand } from '../permissions/destructiveShell.js'
import { getTovyrTierToolBlock } from '../permissions/toolGate.js'
import {
  setTovyrSafeShellBlocked,
} from '../modes.js'
import {
  TOVYR_DEFAULT_MAIN_MAX_TURNS,
  resolveMainLoopMaxTurns,
} from '../agent/mainLoopLimits.js'
import { previewFileEditDiff } from '../tools/safety.js'
import type { BenchCaseDef, BenchCaseResult, BenchRunReport } from './types.js'
import { casesForSuite, type BenchSuiteName } from './suites.js'
import { summarizeResults } from './scoring.js'

const PKG_ROOT = getTovyrPackageRoot()
const LAUNCHER = join(PKG_ROOT, 'bin', 'tovyr.js')

function runLauncher(args: string[], timeoutMs = 60_000): {
  status: number | null
  stdout: string
  stderr: string
} {
  const result = spawnSync(process.execPath, [LAUNCHER, ...args], {
    cwd: PKG_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      TOVYR_PACKAGE_ROOT: PKG_ROOT,
      TOVYR_SRC: PKG_ROOT,
      TOVYR_INVOKE_CWD: PKG_ROOT,
      TOVYR_QUIET: '1',
    },
    timeout: timeoutMs,
  })
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
}

function runPrintPrompt(
  prompt: string,
  timeoutMs: number,
): { status: number | null; stdout: string; stderr: string; durationMs: number } {
  const bun = resolveBunExecutable()
  const entry = join(PKG_ROOT, 'entrypoints', 'cli.tsx')
  const start = Date.now()
  const result = spawnSync(
    bun,
    [
      entry,
      '-p',
      prompt,
      '--bare',
      '--output-format',
      'text',
      '--permission-mode',
      'bypassPermissions',
    ],
    {
      cwd: PKG_ROOT,
      encoding: 'utf8',
      env: {
        ...process.env,
        TOVYR_PACKAGE_ROOT: PKG_ROOT,
        TOVYR_SRC: PKG_ROOT,
        TOVYR_INVOKE_CWD: PKG_ROOT,
        TOVYR_FORCE_INTERACTIVE: '1',
        TOVYR_CODE_SIMPLE: '1',
      },
      timeout: timeoutMs,
    },
  )
  return {
    status: result.status,
    stdout: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    stderr: result.stderr ?? '',
    durationMs: Date.now() - start,
  }
}

function makeResult(
  def: BenchCaseDef,
  passed: boolean,
  durationMs: number,
  opts?: { detail?: string; error?: string; score?: number },
): BenchCaseResult {
  return {
    id: def.id,
    name: def.name,
    category: def.category,
    mode: def.mode,
    passed,
    score: opts?.score ?? (passed ? 100 : 0),
    weight: def.weight,
    durationMs,
    detail: opts?.detail,
    error: opts?.error,
  }
}

async function runOfflineCase(def: BenchCaseDef): Promise<BenchCaseResult> {
  const start = Date.now()

  try {
    switch (def.id) {
      case 'doctor-json': {
        const r = runLauncher(['doctor', '--json'], 90_000)
        const ok = r.status === 0 && r.stdout.includes('"ok"')
        return makeResult(def, ok, Date.now() - start, {
          detail: ok ? 'doctor ok' : `exit ${r.status}`,
          error: ok ? undefined : r.stderr.slice(0, 200),
        })
      }
      case 'config-json': {
        const r = runLauncher(['config', '--json'], 30_000)
        let ok = r.status === 0
        if (ok) {
          try {
            JSON.parse(r.stdout)
          } catch {
            ok = false
          }
        }
        return makeResult(def, ok, Date.now() - start, {
          detail: ok ? 'valid JSON' : 'parse failed',
        })
      }
      case 'project-scan': {
        const scan = scanProject(PKG_ROOT)
        const ok =
          scan.manifests.includes('package.json') && scan.projectType.includes('Node')
        return makeResult(def, ok, Date.now() - start, {
          detail: ok ? scan.projectType : 'no package.json',
        })
      }
      case 'secret-paths': {
        const env = matchSecretPath('.env')
        const key = matchSecretPath('/home/u/.ssh/id_rsa')
        const ok = !!env && !!key
        return makeResult(def, ok, Date.now() - start, {
          detail: ok ? 'env + ssh flagged' : 'missed pattern',
        })
      }
      case 'destructive-shell': {
        const a = matchDestructiveShellCommand('rm -rf /tmp/x')
        const b = matchDestructiveShellCommand('git push --force')
        const c = matchDestructiveShellCommand('npm test')
        const ok = !!a && !!b && !c
        return makeResult(def, ok, Date.now() - start, {
          detail: ok ? 'patterns ok' : 'pattern mismatch',
        })
      }
      case 'tool-gate-plan': {
        process.env.TOVYR_SRC = PKG_ROOT
        const block = getTovyrTierToolBlock('Edit', 'plan', { file_path: 'x.ts' })
        const ok = block?.behavior === 'ask'
        return makeResult(def, !!ok, Date.now() - start, {
          detail: ok ? 'edit blocked' : 'unexpected allow',
        })
      }
      case 'safe-mode-shell': {
        process.env.TOVYR_SRC = PKG_ROOT
        setTovyrSafeShellBlocked(true)
        const block = getTovyrTierToolBlock('Bash', 'default', {
          command: 'npm test',
        })
        setTovyrSafeShellBlocked(false)
        const ok = block?.behavior === 'deny'
        return makeResult(def, !!ok, Date.now() - start, {
          detail: ok ? 'shell denied' : 'shell allowed',
        })
      }
      case 'main-loop-limits': {
        process.env.TOVYR_SRC = PKG_ROOT
        const defTurns = resolveMainLoopMaxTurns()
        process.env.TOVYR_MAX_TURNS = '0'
        const unlimited = resolveMainLoopMaxTurns()
        delete process.env.TOVYR_MAX_TURNS
        const ok =
          defTurns === TOVYR_DEFAULT_MAIN_MAX_TURNS && unlimited === undefined
        return makeResult(def, ok, Date.now() - start, {
          detail: ok ? `default=${defTurns}` : 'resolver mismatch',
        })
      }
      case 'patch-preview': {
        const diff = previewFileEditDiff('a.ts', 'const x = 1\n', 'const x = 2\n')
        const ok = diff.includes('@@') || diff.includes('-') || diff.includes('+')
        return makeResult(def, ok, Date.now() - start, {
          detail: ok ? 'diff produced' : 'empty diff',
        })
      }
      case 'cli-help': {
        const r = runLauncher(['--help'], 15_000)
        const text = `${r.stdout}\n${r.stderr}`
        const ok = r.status === 0 && text.includes('tovyr bench')
        return makeResult(def, ok, Date.now() - start, {
          detail: ok ? 'bench documented' : 'missing bench in help',
        })
      }
      default:
        return makeResult(def, false, Date.now() - start, {
          error: `Unknown offline case: ${def.id}`,
        })
    }
  } catch (err) {
    return makeResult(def, false, Date.now() - start, {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function runLiveCase(
  def: BenchCaseDef,
  timeoutMs: number,
): Promise<BenchCaseResult> {
  const active = resolveActive()
  if (!active?.apiKey && !process.env.ANTHROPIC_API_KEY?.trim()) {
    return makeResult(def, false, 0, {
      error: 'No API key — run tovyr auth login --key <key>',
      score: 0,
    })
  }

  try {
    switch (def.id) {
      case 'live-ping': {
        const r = runPrintPrompt(
          'Reply with exactly this token and nothing else: TOVYR_BENCH_OK',
          timeoutMs,
        )
        const ok =
          r.status === 0 && r.stdout.toUpperCase().includes('TOVYR_BENCH_OK')
        return makeResult(def, ok, r.durationMs, {
          detail: ok ? `${r.durationMs}ms` : `exit ${r.status}`,
          error: ok ? undefined : r.stdout.slice(0, 120),
          score: ok ? 100 : 0,
        })
      }
      case 'live-math': {
        const r = runPrintPrompt(
          'What is 17 multiplied by 23? Reply with the number only.',
          timeoutMs,
        )
        const ok = r.status === 0 && /\b391\b/.test(r.stdout)
        return makeResult(def, ok, r.durationMs, {
          detail: ok ? `${r.durationMs}ms` : 'wrong answer',
          error: ok ? undefined : r.stdout.slice(0, 80),
        })
      }
      case 'live-brief': {
        const r = runPrintPrompt('Say hello in one short sentence.', timeoutMs)
        const trimmed = r.stdout.trim()
        const ok =
          r.status === 0 && trimmed.length > 0 && trimmed.length < 200
        return makeResult(def, ok, r.durationMs, {
          detail: ok ? `${trimmed.length} chars · ${r.durationMs}ms` : 'too long or empty',
        })
      }
      default:
        return makeResult(def, false, 0, {
          error: `Unknown live case: ${def.id}`,
        })
    }
  } catch (err) {
    return makeResult(def, false, 0, {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

export type RunBenchOptions = {
  suite?: BenchSuiteName
  live?: boolean
  cwd?: string
  timeoutMs?: number
}

export async function runBenchmark(
  options: RunBenchOptions = {},
): Promise<BenchRunReport> {
  const suite = options.suite ?? 'offline'
  const wantLive = options.live === true || suite === 'live'
  const cwd = options.cwd ?? PKG_ROOT
  const timeoutMs = options.timeoutMs ?? 120_000
  const startedAt = new Date().toISOString()
  const t0 = Date.now()

  const cases = casesForSuite(suite, wantLive)
  const results: BenchCaseResult[] = []

  for (const def of cases) {
    if (def.mode === 'live') {
      if (!wantLive) continue
      results.push(await runLiveCase(def, timeoutMs))
    } else {
      results.push(await runOfflineCase(def))
    }
  }

  const liveIncluded = results.some(r => r.mode === 'live')
  const active = resolveActive()

  const report: BenchRunReport = {
    version: 1,
    suite,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    cwd,
    provider: active?.providerId,
    model: active?.model,
    tovyrVersion: TOVYR_VERSION,
    results,
    summary: summarizeResults(results, liveIncluded),
  }

  return report
}

export function benchmarkDir(cwd = PKG_ROOT): string {
  return join(cwd, '.tovyr', 'benchmarks')
}

export function saveBenchmarkReport(
  report: BenchRunReport,
  cwd = PKG_ROOT,
): { latestPath: string; historyPath: string } {
  const dir = benchmarkDir(cwd)
  mkdirSync(dir, { recursive: true })

  const stamp = report.startedAt.replace(/[:.]/g, '-')
  const historyPath = join(dir, `run-${stamp}.json`)
  const latestPath = join(dir, 'latest.json')
  const previousPath = join(dir, 'previous.json')

  if (existsSync(latestPath)) {
    try {
      const prev = readFileSync(latestPath, 'utf8')
      writeFileSync(previousPath, prev, 'utf8')
    } catch {
      /* ignore */
    }
  }

  const body = JSON.stringify(report, null, 2)
  writeFileSync(latestPath, body, 'utf8')
  writeFileSync(historyPath, body, 'utf8')

  return { latestPath, historyPath }
}

export function loadBenchmarkReport(
  which: 'latest' | 'previous',
  cwd = PKG_ROOT,
): BenchRunReport | null {
  const path = join(benchmarkDir(cwd), `${which}.json`)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as BenchRunReport
  } catch {
    return null
  }
}
