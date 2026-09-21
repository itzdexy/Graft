import type { PermissionMode } from '../../../types/permissions.js'
import { getCwd } from '../../../utils/cwd.js'
import { isGraftRuntime } from '../../../utils/graftRuntime.js'
import {
  consumeLintHintAfterEdits,
  consumeVerifySuggestion,
  shouldAutoVerifyAfterEdits,
} from './editHook.js'
import { detectProjectScripts } from './projectScripts.js'
import { verifyPromptForCwd } from './verifyPrompts.js'

export const MAX_VERIFY_RECOVERY_ROUNDS = 3

export type AutoVerifyOutcome =
  | { kind: 'skip' }
  | { kind: 'lint_only'; message: string }
  | { kind: 'requested'; feedback: string }

export function graftAutoVerifyEnabled(permissionMode: PermissionMode): boolean {
  if (!isGraftRuntime()) return false
  if (permissionMode === 'plan') return false
  if (process.env.GRAFT_AUTO_VERIFY === '0') return false
  return true
}

/** Request visible shell-tool verification; never execute scripts or commit here. */
export async function runGraftAutoVerifyIfNeeded(
  permissionMode: PermissionMode,
  agentId?: string,
): Promise<AutoVerifyOutcome> {
  if (!graftAutoVerifyEnabled(permissionMode)) {
    return { kind: 'skip' }
  }
  if (!shouldAutoVerifyAfterEdits(permissionMode, agentId)) {
    return { kind: 'skip' }
  }
  if (!consumeVerifySuggestion(permissionMode, agentId)) {
    return { kind: 'skip' }
  }

  const lintHint = consumeLintHintAfterEdits(agentId)
  const cwd = getCwd()
  if (!detectProjectScripts(cwd).checks.length) {
    if (lintHint) {
      return { kind: 'lint_only', message: lintHint }
    }
    return { kind: 'skip' }
  }

  const prompt = await verifyPromptForCwd(cwd)
  return {
    kind: 'requested',
    feedback: [
      'Check the edits before completing this task. Verification has not been run by this hook.',
      ...prompt.flatMap(block => block.type === 'text' ? [block.text] : []),
      'If a relevant check already ran after the latest edit, reuse its actual tool result instead of running it again. Otherwise run the relevant checks through the normal shell tool.',
      'Fix failures only within the requested task. Report unrelated baseline failures, cancellation, and unavailable checks honestly. Do not stage or commit changes automatically.',
      lintHint,
    ]
      .filter(Boolean)
      .join('\n'),
  }
}
