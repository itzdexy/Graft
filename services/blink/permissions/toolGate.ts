import type { PermissionResult } from '../../../utils/permissions/PermissionResult.js'
import type { PermissionMode } from '../../../types/permissions.js'
import { isBlinkRuntime } from '../../../utils/blinkRuntime.js'
import { categoryForToolName } from '../tools/framework.js'
import { resolveToolPermission } from '../tools/policies.js'
import { isShellAllowlisted } from './shellAllowlist.js'
import {
  type BlinkPermissionTier,
  blinkTierForMode,
} from './tiers.js'
import { isBlinkSafeShellBlocked } from '../modes.js'
import {
  formatSecretPathBlockMessage,
  matchSecretPath,
} from './secretPaths.js'
import { matchDestructiveShellCommand } from './destructiveShell.js'

const TIER_RANK: Record<BlinkPermissionTier, number> = {
  read_only: 0,
  auto_edit: 1,
  full_auto: 2,
  yolo: 3,
}

const READ_ONLY_TOOLS = new Set([
  'Read',
  'Glob',
  'Grep',
  'LS',
  'NotebookRead',
  'WebFetch',
  'WebSearch',
  'LSPTool',
  'LSP',
  'TaskList',
  'TodoRead',
  'BrowserUse',
  'BlinkWeb',
  'WebBrowser',
])

function isReadOnlyToolName(toolName: string): boolean {
  if (READ_ONLY_TOOLS.has(toolName)) return true
  const lower = toolName.toLowerCase()
  if (lower.includes('read') && !lower.includes('write') && !lower.includes('edit')) {
    return true
  }
  return false
}

function extractShellCommand(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null
  if ('command' in input && typeof input.command === 'string') {
    return input.command
  }
  return null
}

function extractFilePath(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null
  for (const key of ['file_path', 'path', 'target_file', 'notebook_path']) {
    if (key in input && typeof input[key as keyof typeof input] === 'string') {
      return (input as Record<string, string>)[key]
    }
  }
  return null
}

function allowDecision(
  permissionMode: PermissionMode,
  input?: unknown,
): PermissionResult {
  return {
    behavior: 'allow',
    updatedInput:
      input && typeof input === 'object'
        ? (input as { [key: string]: unknown })
        : undefined,
    decisionReason: { type: 'mode', mode: permissionMode },
  }
}

/** Shell patterns that create files — unreliable on Windows and blocked in code mode. */
export function isBashFileCreationCommand(command: string): boolean {
  const trimmed = command.trim()
  if (!trimmed) return false
  return /^(touch|echo\s+.+\s*>|cat\s+>\s*|tee\s+|New-Item|Out-File|Set-Content|\$null\s*>)/i.test(
    trimmed,
  )
}

/**
 * Blink tier gate for native and MCP tools.
 * Returns null when stock permission flow should proceed unchanged.
 */
export function getBlinkTierToolBlock(
  toolName: string,
  permissionMode: PermissionMode,
  input?: unknown,
): PermissionResult | null {
  if (!isBlinkRuntime()) return null
  if (permissionMode === 'bypassPermissions') return null

  const policy = resolveToolPermission(toolName)
  if (policy === 'deny') {
    return {
      behavior: 'deny',
      message: `Tool ${toolName} is denied by ~/.blink/tool-policies.json`,
      decisionReason: { type: 'mode', mode: permissionMode },
    }
  }
  if (policy === 'ask') {
    return {
      behavior: 'ask',
      message: `Tool ${toolName} requires confirmation per Blink tool policy.`,
      decisionReason: { type: 'mode', mode: permissionMode },
    }
  }

  const tier = blinkTierForMode(permissionMode)
  const rank = TIER_RANK[tier]
  const category = categoryForToolName(toolName)
  const readOnly = isReadOnlyToolName(toolName)

  const filePath = extractFilePath(input)
  if (filePath) {
    const secret = matchSecretPath(filePath)
    if (secret && permissionMode !== 'bypassPermissions') {
      return {
        behavior: 'ask',
        message: formatSecretPathBlockMessage(secret),
        decisionReason: { type: 'mode', mode: permissionMode },
      }
    }
  }

  if (readOnly || category === 'search' || category === 'code_analysis') {
    return null
  }

  if (category === 'filesystem' && !readOnly) {
    if (rank < TIER_RANK.auto_edit) {
      return {
        behavior: 'ask',
        message:
          'File edits require `/code` (auto-edit) or `/bypass` (yolo). Use `/plan` for read-only planning.',
        decisionReason: { type: 'mode', mode: permissionMode },
      }
    }
    // Ask + Code: auto-accept Write/Edit so stock `default` mode does not re-prompt.
    return allowDecision(permissionMode, input)
  }

  if (category === 'terminal') {
    if (isBlinkSafeShellBlocked()) {
      return {
        behavior: 'deny',
        message:
          'Shell is disabled in safe mode. Use `/build` or `/code` to run commands, or `/bypass` if the user accepts full auto mode.',
        decisionReason: { type: 'mode', mode: permissionMode },
      }
    }
    const command = extractShellCommand(input)
    if (
      command &&
      rank >= TIER_RANK.auto_edit &&
      rank < TIER_RANK.yolo &&
      isBashFileCreationCommand(command)
    ) {
      return {
        behavior: 'deny',
        message:
          'In code mode, create files with the Write tool (not Bash). Bash file commands fail or need extra approval on Windows. Call Write with file_path and content now.',
        decisionReason: { type: 'mode', mode: permissionMode },
      }
    }
    if (command) {
      const destructive = matchDestructiveShellCommand(command)
      if (destructive) {
        return {
          behavior: 'ask',
          message:
            `Blink blocked a potentially destructive command (${destructive}). ` +
            'Confirm with the user, or use /bypass only if they explicitly accept the risk.',
          decisionReason: { type: 'mode', mode: permissionMode },
        }
      }
    }
    // Ask/Code: auto-run allowlisted shell (git, gh, npm, …).
    if (
      command &&
      rank >= TIER_RANK.auto_edit &&
      rank < TIER_RANK.yolo &&
      isShellAllowlisted(command)
    ) {
      return allowDecision(permissionMode, input)
    }
    if (rank < TIER_RANK.full_auto) {
      return {
        behavior: 'ask',
        message:
          'This shell command is not on the Blink allowlist. Confirm to run it, or use `/bypass` for full auto.',
        decisionReason: { type: 'mode', mode: permissionMode },
      }
    }
    if (command && rank === TIER_RANK.full_auto && !isShellAllowlisted(command)) {
      return {
        behavior: 'ask',
        message: `Shell command not on the Blink allowlist. Confirm: ${command.slice(0, 120)}`,
        decisionReason: { type: 'mode', mode: permissionMode },
      }
    }
    return null
  }

  if (category === 'browser' || category === 'agent') {
    if (rank < TIER_RANK.full_auto) {
      return {
        behavior: 'ask',
        message:
          `${category === 'browser' ? 'Browser' : 'Agent'} tools need full-auto or `/bypass` — confirm to proceed.`,
        decisionReason: { type: 'mode', mode: permissionMode },
      }
    }
  }

  return null
}
