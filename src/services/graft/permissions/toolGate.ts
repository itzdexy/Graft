import type { PermissionDecision } from '../../../utils/permissions/PermissionResult.js'
import type { PermissionMode } from '../../../types/permissions.js'
import { isAbsolute, relative, sep } from 'node:path'
import { isGraftRuntime } from '../../../utils/graftRuntime.js'
import { expandPath } from '../../../utils/path.js'
import { getCwd } from '../../../utils/cwd.js'
import { categoryForToolName } from '../tools/framework.js'
import { resolveToolPermission } from '../tools/policies.js'
import {
  classifyShellRisk,
  formatShellRiskPrompt,
} from './shellRisk.js'
import {
  type GraftPermissionTier,
  graftTierForMode,
} from './tiers.js'
import { isGraftSafeShellBlocked } from '../modes.js'
import {
  formatSecretPathBlockMessage,
  matchSecretPath,
} from './secretPaths.js'
import { matchDestructiveShellCommand } from './destructiveShell.js'
import { isRoutineDirectoryInspection } from './routineInspection.js'

const TIER_RANK: Record<GraftPermissionTier, number> = {
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
  'GraftWeb',
  'WebBrowser',
])

/**
 * Tools that manage the turn itself rather than the machine: todo lists, plan
 * exit, skill loading, task bookkeeping.
 *
 * `categoryForToolName` classifies by substring, so `TodoWrite` landed in
 * `filesystem` and `TaskOutput` in `agent`. Both then produced permission
 * prompts for actions that write nothing and run nothing.
 */
const WORKFLOW_TOOLS = new Set([
  'TodoWrite',
  'TodoRead',
  'TaskList',
  'TaskOutput',
  'TaskStop',
  'ExitPlanMode',
  'Skill',
  'SlashCommand',
  'ListMcpResourcesTool',
  'ReportFindings',
])

export function isWorkflowToolName(toolName: string): boolean {
  return WORKFLOW_TOOLS.has(toolName)
}

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

function extractFilePath(
  input: unknown,
): { key: string; value: string } | null {
  if (!input || typeof input !== 'object') return null
  for (const key of ['file_path', 'path', 'target_file', 'notebook_path']) {
    if (key in input && typeof input[key as keyof typeof input] === 'string') {
      return { key, value: (input as Record<string, string>)[key]! }
    }
  }
  return null
}

function isWithinWorkspace(filePath: string): boolean {
  const workspaceRelativePath = relative(getCwd(), filePath)
  return (
    workspaceRelativePath === '' ||
    (workspaceRelativePath !== '..' &&
      !workspaceRelativePath.startsWith(`..${sep}`) &&
      !isAbsolute(workspaceRelativePath))
  )
}

function allowDecision(
  permissionMode: PermissionMode,
  input?: unknown,
): PermissionDecision {
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
 * Graft tier gate for native and MCP tools.
 * Returns null when stock permission flow should proceed unchanged.
 */
export function getGraftTierToolBlock(
  toolName: string,
  permissionMode: PermissionMode,
  input?: unknown,
): PermissionDecision | null {
  if (!isGraftRuntime()) return null
  if (permissionMode === 'bypassPermissions') return null

  const policy = resolveToolPermission(toolName)
  if (policy === 'deny') {
    return {
      behavior: 'deny',
      message: `Tool ${toolName} is denied by ~/.graft/tool-policies.json`,
      decisionReason: { type: 'mode', mode: permissionMode },
    }
  }
  if (policy === 'ask') {
    return {
      behavior: 'ask',
      message: `Tool ${toolName} requires confirmation per Graft tool policy.`,
      decisionReason: { type: 'mode', mode: permissionMode },
    }
  }

  if (isWorkflowToolName(toolName)) return null

  const tier = graftTierForMode(permissionMode)
  const rank = TIER_RANK[tier]
  const category = categoryForToolName(toolName)
  const readOnly = isReadOnlyToolName(toolName)

  const filePathEntry = extractFilePath(input)
  if (filePathEntry) {
    const secret = matchSecretPath(filePathEntry.value)
    if (secret) {
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
    const workspaceFilePath = filePathEntry
      ? expandPath(filePathEntry.value, getCwd())
      : null
    // Unknown and outside-workspace targets continue through the stock
    // filesystem gate, which owns allowed-directory and safety checks.
    if (!workspaceFilePath || !isWithinWorkspace(workspaceFilePath)) {
      return null
    }
    // Canonicalize relative model output so writes consistently land in the
    // folder Graft was launched from.
    return allowDecision(permissionMode, {
      ...(input && typeof input === 'object' ? input : {}),
      [filePathEntry!.key]: workspaceFilePath,
    })
  }

  if (category === 'terminal') {
    if (isGraftSafeShellBlocked()) {
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
            `Graft blocked a potentially destructive command (${destructive}). ` +
            'Confirm with the user, or use /bypass only if they explicitly accept the risk.',
          decisionReason: { type: 'mode', mode: permissionMode },
        }
      }
    }
    // Ask/Code and above: run unless the command is genuinely powerful.
    //
    // This used to gate on a 47-entry allowlist, so anything unlisted —
    // mkdir, cp, sed, docker build, cargo run, tsc, every Windows cmdlet,
    // every project-local script — stopped and asked. An allowlist cannot
    // cover the long tail of a build system, and each miss reads as the tool
    // being broken. Now only elevation, things that leave the machine, and
    // changes outside the project interrupt; destructive commands were
    // already handled above.
    if (command && rank >= TIER_RANK.auto_edit) {
      const risk = classifyShellRisk(command)
      if (risk) {
        return {
          behavior: 'ask',
          message: formatShellRiskPrompt(risk),
          decisionReason: { type: 'mode', mode: permissionMode },
        }
      }
      return allowDecision(permissionMode, input)
    }

    // Directory inspection is read-only in plan mode as well.
    if (command && isRoutineDirectoryInspection(command)) return allowDecision(permissionMode, input)

    // Other shell commands still need approval in read-only mode.
    if (rank < TIER_RANK.auto_edit) {
      return {
        behavior: 'ask',
        message:
          'Plan mode does not run shell commands. Run `/code` to let Graft act, or confirm to run this one.',
        decisionReason: { type: 'mode', mode: permissionMode },
      }
    }
    return null
  }

  // Browser and subagent launches.
  //
  // Two bugs lived here. The message was an unterminated template literal
  // (`… or ` /bypass ` …`), so this branch threw a ReferenceError instead of
  // returning a decision — every subagent launch in ask/code mode blew up the
  // permission gate. And the bar was full-auto, which contradicted the tool
  // framework's own default (browser: allow) and prompted for `Task` on every
  // turn that used one.
  //
  // A subagent is not itself a privileged action: every tool it runs comes
  // back through this same gate at the same tier. So gate only in read-only
  // mode, where the point is that nothing should start acting.
  if (category === 'browser' || category === 'agent') {
    if (rank < TIER_RANK.auto_edit) {
      const label = category === 'browser' ? 'Browser' : 'Agent'
      return {
        behavior: 'ask',
        message: `${label} tools are paused in plan mode. Run /code to let them act, or confirm to proceed.`,
        decisionReason: { type: 'mode', mode: permissionMode },
      }
    }
  }

  return null
}
