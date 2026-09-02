import type { ToolPermissionContext } from '../../../Tool.js'
import type { PermissionResult } from '../../../utils/permissions/PermissionResult.js'
import { isTovyrRuntime } from '../../../utils/tovyrRuntime.js'

const DESTRUCTIVE_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /\brm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+|.*\s-f)/, label: 'recursive force delete (rm -rf)' },
  { re: /\bgit\s+push\b[^\n]*--force\b/, label: 'force push' },
  { re: /\bgit\s+push\b[^\n]*-f\b/, label: 'force push' },
  { re: /\bgit\s+reset\s+--hard\b/, label: 'hard git reset' },
  { re: /\bgit\s+clean\s+-[a-zA-Z]*f/, label: 'git clean -f' },
  { re: /\bdrop\s+database\b/i, label: 'DROP DATABASE' },
  { re: /\btruncate\s+table\b/i, label: 'TRUNCATE TABLE' },
  { re: /\bmkfs\b/, label: 'filesystem format (mkfs)' },
  { re: /\bdd\s+if=/, label: 'raw disk write (dd)' },
  { re: /\bformat\s+[a-z]:/i, label: 'disk format (format)' },
  { re: /\bdel\s+\/[sfq]/i, label: 'recursive delete (del /s)' },
  { re: /\bRemove-Item\b[^\n]*-Recurse\b[^\n]*-Force/i, label: 'recursive force delete (PowerShell)' },
  { re: /\bgit\s+config\s+--global\b/, label: 'global git config change' },
  { re: /\bchmod\s+-R\s+777\b/, label: 'chmod -R 777' },
  { re: /\bgit\s+push\b[^\n]*--delete\b/, label: 'git push --delete' },
  { re: /\bcurl\b[^\n]*\|\s*(ba)?sh\b/, label: 'curl pipe to shell' },
  { re: /\bwget\b[^\n]*\|\s*(ba)?sh\b/, label: 'wget pipe to shell' },
  { re: /\b(sh|bash)\s+<\s*\(\s*curl\b/, label: 'curl into shell' },
]

/**
 * Catch `rm` invocations that are both forced and recursive regardless of flag
 * order or position — e.g. `rm ./dir -rf`, `rm -r -f dir`, `rm --recursive
 * --force dir` — which the positional regex above can miss. Scans every
 * whitespace-separated command segment (split on shell separators) so a
 * destructive rm buried after `&&`/`;`/`|` is still detected.
 */
function matchForcedRecursiveRm(command: string): boolean {
  for (const segment of command.split(/[;&|]+/)) {
    const tokens = segment.trim().split(/\s+/)
    if (tokens.length === 0) continue
    const cmd = tokens[0]!.split(/[\\/]/).pop()
    if (cmd !== 'rm') continue
    let force = false
    let recursive = false
    for (const tok of tokens.slice(1)) {
      if (tok === '--force') force = true
      else if (tok === '--recursive') recursive = true
      else if (/^-[a-zA-Z]+$/.test(tok)) {
        if (tok.includes('f')) force = true
        if (tok.includes('r') || tok.includes('R')) recursive = true
      }
    }
    if (force && recursive) return true
  }
  return false
}

export function matchDestructiveShellCommand(command: string): string | null {
  const normalized = command.trim()
  for (const { re, label } of DESTRUCTIVE_PATTERNS) {
    if (re.test(normalized)) return label
  }
  if (matchForcedRecursiveRm(normalized)) {
    return 'recursive force delete (rm -rf)'
  }
  return null
}

/** Block destructive shell in Tovyr unless bypass mode is active. */
export function getTovyrDestructiveShellBlock(
  command: string,
  toolPermissionContext: ToolPermissionContext,
): PermissionResult | null {
  if (!isTovyrRuntime()) return null
  if (toolPermissionContext.mode === 'bypassPermissions') return null

  const label = matchDestructiveShellCommand(command)
  if (!label) return null

  return {
    behavior: 'ask',
    message:
      `Tovyr blocked a potentially destructive command (${label}). ` +
      'Confirm with the user, or use /bypass only if they explicitly accept the risk.',
    decisionReason: { type: 'mode', mode: toolPermissionContext.mode },
  }
}
