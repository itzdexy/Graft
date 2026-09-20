import { getCwd } from '../../../utils/cwd.js'
import { isGraftRuntime } from '../../../utils/graftRuntime.js'
import type { PermissionMode } from '../../../types/permissions.js'
import { suggestLintAfterEdit } from '../ecosystem/lint/suggestLint.js'
import { loadAgentSession } from '../agent/persistence.js'

let editsSinceVerify = 0
let pendingLintHint: string | null = null

export function resetVerifyEditCounter(): void {
  editsSinceVerify = 0
  pendingLintHint = null
}

export function noteCodeEditForVerify(): void {
  if (!isGraftRuntime()) return
  editsSinceVerify++
  const hint = suggestLintAfterEdit(getCwd())
  if (hint) pendingLintHint = hint
}

export function getEditsSinceVerify(): number {
  return editsSinceVerify
}

/** Whether auto-verify should run after edits in this permission mode. */
export function shouldAutoVerifyAfterEdits(
  permissionMode: PermissionMode = 'default',
): boolean {
  if (!isGraftRuntime() || editsSinceVerify < 1) return false
  if (permissionMode === 'plan') return false
  if (process.env.GRAFT_AUTO_VERIFY === '0') return false
  const session = loadAgentSession(getCwd())
  if (session?.autoFix) return true
  return true
}

/** @deprecated use shouldAutoVerifyAfterEdits */
export function shouldSuggestVerifyAfterEdits(): boolean {
  return shouldAutoVerifyAfterEdits('acceptEdits')
}

export function consumeVerifySuggestion(
  permissionMode: PermissionMode = 'default',
): boolean {
  if (!shouldAutoVerifyAfterEdits(permissionMode)) return false
  editsSinceVerify = 0
  return true
}

/** Aider-style lint reminder after edits (consumed once). */
export function consumeLintHintAfterEdits(): string | null {
  const hint = pendingLintHint
  pendingLintHint = null
  return hint
}
