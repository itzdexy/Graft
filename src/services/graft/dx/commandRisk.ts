/**
 * Risk level for a shell command, for display.
 *
 * The permission gate already decides whether to *stop* for a command. This
 * decides how the row *reads* once it is running or done — a `git push` that
 * the user approved should still be visibly different from `ls`, because the
 * transcript is what they scroll back through when something went wrong.
 *
 * Display-only: it never grants or denies anything. `toolGate.ts` owns that.
 */

import { matchDestructiveShellCommand } from '../permissions/destructiveShell.js'
import { classifyShellRisk } from '../permissions/shellRisk.js'
import type { ToolRisk } from './toolPresentation.js'

export type CommandRiskInfo = {
  level: ToolRisk
  /** Short reason, shown next to the warning glyph. */
  label: string | null
}

/**
 * `high` is reserved for things that destroy data — the rows a user scans for
 * first when a session went wrong. `medium` covers elevation, publishing and
 * machine changes: consequential, but recoverable and often intended.
 */
export function classifyCommandRisk(command: string): CommandRiskInfo {
  const destructive = matchDestructiveShellCommand(command)
  if (destructive) return { level: 'high', label: destructive }

  const risk = classifyShellRisk(command)
  if (risk) return { level: 'medium', label: risk.label }

  return { level: 'none', label: null }
}

/** Glyph shown before a risky command. Empty for ordinary ones. */
export function commandRiskGlyph(level: ToolRisk): string {
  switch (level) {
    case 'high':
      return '⚠'
    case 'medium':
      return '!'
    default:
      return ''
  }
}

/**
 * Theme colour for a risky row. Ordinary rows keep whatever colour their
 * status implies, so risk styling never competes with success/failure.
 */
export function commandRiskColor(level: ToolRisk): 'error' | 'warning' | null {
  switch (level) {
    case 'high':
      return 'error'
    case 'medium':
      return 'warning'
    default:
      return null
  }
}
