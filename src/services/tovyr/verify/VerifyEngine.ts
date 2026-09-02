/**
 * Tovyr Verify Engine
 *
 * Provides build/test/lint verification with automatic error analysis and fix suggestions.
 * Detects project scripts (npm, bun, pnpm, yarn, Cargo, Go, Python) and runs them with timeout handling.
 *
 * Integrated with agent auto-fix mode for continuous verification loops.
 *
 * @module services/tovyr/verify/VerifyEngine
 */

import { execFileNoThrowWithCwd } from '../../../utils/execFileNoThrow.js'
import {
  extractErrorsFromOutput,
  suggestFixStrategy,
  summarizeErrors,
} from './errorAnalysis.js'
import type { VerifyCheck, VerifyCheckKind } from './projectScripts.js'
import { detectProjectScripts, formatProjectScripts } from './projectScripts.js'

export type VerifyCheckResult = {
  check: VerifyCheck
  code: number
  stdout: string
  stderr: string
  durationMs: number
  passed: boolean
}

export type VerificationReport = {
  cwd: string
  ranAt: number
  results: VerifyCheckResult[]
  allPassed: boolean
}

export type VerifyOptions = {
  kinds?: VerifyCheckKind[]
  timeoutMs?: number
  stopOnFirstFailure?: boolean
}

const DEFAULT_TIMEOUT = 5 * 60 * 1000

export async function runVerifyCheck(
  cwd: string,
  check: VerifyCheck,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<VerifyCheckResult> {
  const started = Date.now()
  const { stdout, stderr, code } = await execFileNoThrowWithCwd(
    check.command,
    check.args,
    { cwd, timeout: timeoutMs, preserveOutputOnError: true },
  )
  return {
    check,
    code,
    stdout,
    stderr,
    durationMs: Date.now() - started,
    passed: code === 0,
  }
}

export async function runVerification(
  cwd: string,
  options: VerifyOptions = {},
): Promise<VerificationReport> {
  const scripts = detectProjectScripts(cwd)
  let checks = scripts.checks
  if (options.kinds?.length) {
    checks = checks.filter(c => options.kinds!.includes(c.kind))
  }

  const results: VerifyCheckResult[] = []
  for (const check of checks) {
    const result = await runVerifyCheck(cwd, check, options.timeoutMs)
    results.push(result)
    if (!result.passed && options.stopOnFirstFailure) break
  }

  return {
    cwd,
    ranAt: Date.now(),
    results,
    allPassed: results.length > 0 && results.every(r => r.passed),
  }
}

export function formatVerificationReport(report: VerificationReport): string {
  if (!report.results.length) {
    return formatProjectScripts(detectProjectScripts(report.cwd))
  }

  const lines = [
    `# Verification ${report.allPassed ? 'PASSED' : 'FAILED'}`,
    '',
  ]

  for (const r of report.results) {
    const status = r.passed ? 'PASS' : 'FAIL'
    lines.push(
      `## ${r.check.kind} — ${status} (exit ${r.code}, ${r.durationMs}ms)`,
      `Command: \`${r.check.command} ${r.check.args.join(' ')}\``,
      '',
    )
    const output = (r.stderr || r.stdout).trim()
    if (output) {
      const tail = output.split('\n').slice(-40).join('\n')
      lines.push('```', tail, '```', '')
    }
    if (!r.passed) {
      const combined = `${r.stdout}\n${r.stderr}`
      const errors = extractErrorsFromOutput(combined)
      lines.push(summarizeErrors(errors), '')
      const hints = suggestFixStrategy(errors)
      if (hints.length) {
        lines.push('### Suggested fixes', ...hints.map(h => `- ${h}`), '')
      }
    }
  }

  return lines.join('\n')
}

export function getVerifyCommandsForPrompt(cwd: string): string {
  return formatProjectScripts(detectProjectScripts(cwd))
}
