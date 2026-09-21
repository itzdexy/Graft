import { resolve } from 'node:path'
import { getCwd } from '../../../utils/cwd.js'
import { isGraftRuntime } from '../../../utils/graftRuntime.js'
import type { PermissionMode } from '../../../types/permissions.js'
import { suggestLintAfterEdit } from '../ecosystem/lint/suggestLint.js'

const pendingEdits = new Map<string, { count: number; lintHint: string | null }>()

function scope(agentId?: string): string {
  const path = resolve(getCwd())
  return JSON.stringify([process.platform === 'win32' ? path.toLowerCase() : path, agentId ?? null])
}

export function resetVerifyEditCounter(agentId?: string): void {
  pendingEdits.delete(scope(agentId))
}

export function noteCodeEditForVerify(agentId?: string): void {
  if (!isGraftRuntime() || process.env.GRAFT_AUTO_VERIFY === '0') return
  const key = scope(agentId)
  const previous = pendingEdits.get(key)
  pendingEdits.set(key, { count: (previous?.count ?? 0) + 1, lintHint: suggestLintAfterEdit(getCwd()) ?? previous?.lintHint ?? null })
}

export function getEditsSinceVerify(agentId?: string): number {
  return pendingEdits.get(scope(agentId))?.count ?? 0
}

/** Pending edits belong to one project and agent, not the whole process. */
export function shouldAutoVerifyAfterEdits(permissionMode: PermissionMode = 'default', agentId?: string): boolean {
  return isGraftRuntime() && getEditsSinceVerify(agentId) > 0 && permissionMode !== 'plan' && process.env.GRAFT_AUTO_VERIFY !== '0'
}

/** @deprecated use shouldAutoVerifyAfterEdits */
export function shouldSuggestVerifyAfterEdits(): boolean {
  return shouldAutoVerifyAfterEdits('acceptEdits')
}

export function consumeVerifySuggestion(permissionMode: PermissionMode = 'default', agentId?: string): boolean {
  if (!shouldAutoVerifyAfterEdits(permissionMode, agentId)) return false
  const pending = pendingEdits.get(scope(agentId))!
  pending.count = 0
  if (!pending.lintHint) pendingEdits.delete(scope(agentId))
  return true
}

export function consumeLintHintAfterEdits(agentId?: string): string | null {
  const key = scope(agentId)
  const pending = pendingEdits.get(key)
  if (!pending) return null
  const hint = pending.lintHint
  pending.lintHint = null
  if (!pending.count) pendingEdits.delete(key)
  return hint
}
