import type { PermissionMode } from '../../../types/permissions.js'
import { getCwd } from '../../../utils/cwd.js'
import { isTovyrRuntime } from '../../../utils/tovyrRuntime.js'
import { commitTovyrChanges } from '../git/checkpoint.js'
import {
  consumeLintHintAfterEdits,
  consumeVerifySuggestion,
  shouldAutoVerifyAfterEdits,
} from './editHook.js'
import {
  formatVerificationReport,
  runVerification,
} from './VerifyEngine.js'

export const MAX_VERIFY_RECOVERY_ROUNDS = 3

export type AutoVerifyOutcome =
  | { kind: 'skip' }
  | { kind: 'lint_only'; message: string }
  | { kind: 'passed'; message: string }
  | { kind: 'failed'; feedback: string }

export function tovyrAutoVerifyEnabled(permissionMode: PermissionMode): boolean {
  if (!isTovyrRuntime()) return false
  if (permissionMode === 'plan') return false
  if (process.env.TOVYR_AUTO_VERIFY === '0') return false
  return true
}

/** Run lint/test after code edits when Tovyr auto-verify is enabled. */
export async function runTovyrAutoVerifyIfNeeded(
  permissionMode: PermissionMode,
): Promise<AutoVerifyOutcome> {
  if (!tovyrAutoVerifyEnabled(permissionMode)) {
    return { kind: 'skip' }
  }
  if (!shouldAutoVerifyAfterEdits(permissionMode)) {
    return { kind: 'skip' }
  }
  if (!consumeVerifySuggestion(permissionMode)) {
    return { kind: 'skip' }
  }

  const lintHint = consumeLintHintAfterEdits()
  const cwd = getCwd()
  const report = await runVerification(cwd, { stopOnFirstFailure: true })
  if (!report.results.length) {
    if (lintHint) {
      return { kind: 'lint_only', message: lintHint }
    }
    return { kind: 'skip' }
  }

  const formatted = formatVerificationReport(report)
  const lintSuffix = lintHint ? `\n\n${lintHint}` : ''
  if (report.allPassed) {
    const commit = await commitTovyrChanges(cwd, 'auto-verify passed')
    const commitLine = commit.ok ? `\n${commit.message}` : ''
    return {
      kind: 'passed',
      message: `${formatted}${commitLine}${lintSuffix}`.trim(),
    }
  }

  return {
    kind: 'failed',
    feedback: [
      formatted,
      '',
      'Verification failed after your edits. Read the errors above, fix the code, and re-run checks. Do not report the task as done until verification passes.',
      lintSuffix,
    ]
      .filter(Boolean)
      .join('\n'),
  }
}
