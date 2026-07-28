/**
 * Tovyr tool execution safety — structured errors, secret redaction, path checks,
 * diff previews, and debug logging helpers.
 */

import { redactSecretsForLogs } from '../../../bridge/debugUtils.js'
import type { ToolPermissionContext } from '../../../Tool.js'
import { getPatchFromContents } from '../../../utils/diff.js'
import { isAbortError, errorMessage, getErrnoCode } from '../../../utils/errors.js'
import {
  type FileOperationType,
  validatePath,
} from '../../../utils/permissions/pathValidation.js'
import { getDefaultBashTimeoutMs } from '../../../utils/timeouts.js'
import { matchDestructiveShellCommand } from '../permissions/destructiveShell.js'

export type ToolErrorKind =
  | 'path_invalid'
  | 'path_denied'
  | 'timeout'
  | 'cancelled'
  | 'permission_denied'
  | 'destructive_command'
  | 'not_found'
  | 'network'
  | 'unknown'

export type StructuredToolError = {
  kind: ToolErrorKind
  message: string
  tool?: string
  detail?: string
}

/** Default timeouts (ms) for Tovyr tool categories. */
export const TOVYR_TOOL_TIMEOUT_MS = {
  bash: getDefaultBashTimeoutMs(),
  grep: 30_000,
  fetch: 30_000,
  file: 60_000,
} as const

const LOG_TRUNCATE = 500

/** Redact secrets and API keys from tool log strings. */
export function redactSecretsForToolLog(text: string): string {
  return redactSecretsForLogs(text)
}

export function isCancellationError(error: unknown): boolean {
  return isAbortError(error)
}

/** Whether a tool error is safe to retry (transient network/timeout only). */
export function isRetryableToolError(error: unknown): boolean {
  if (isCancellationError(error)) return false
  const msg = error instanceof Error ? error.message : String(error)
  if (/destructive|permission denied|EACCES|EPERM|invalid path/i.test(msg)) {
    return false
  }
  return /timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|rate limit|429|503|socket hang up/i.test(
    msg,
  )
}

export function classifyTovyrToolError(
  error: unknown,
  toolName?: string,
): StructuredToolError {
  if (isCancellationError(error)) {
    return {
      kind: 'cancelled',
      tool: toolName,
      message: 'Tool execution was cancelled.',
      detail: errorMessage(error),
    }
  }

  const msg = errorMessage(error)
  const errno = error instanceof Error ? getErrnoCode(error) : undefined

  if (errno === 'ENOENT') {
    return {
      kind: 'not_found',
      tool: toolName,
      message: 'File or path not found.',
      detail: msg,
    }
  }

  if (/timeout|timed out|ETIMEDOUT/i.test(msg)) {
    return {
      kind: 'timeout',
      tool: toolName,
      message: 'Tool execution timed out. Try a narrower scope or increase the timeout.',
      detail: msg,
    }
  }

  if (/destructive command|blocked a potentially destructive/i.test(msg)) {
    return {
      kind: 'destructive_command',
      tool: toolName,
      message: msg,
    }
  }

  if (/permission denied|not allowed|denied by your permission/i.test(msg)) {
    return {
      kind: 'permission_denied',
      tool: toolName,
      message: msg,
    }
  }

  if (
    /invalid path|path traversal|shell expansion|glob pattern|UNC network/i.test(
      msg,
    )
  ) {
    return {
      kind: 'path_invalid',
      tool: toolName,
      message: msg,
    }
  }

  if (/ECONNRESET|ECONNREFUSED|network|fetch failed|ENOTFOUND/i.test(msg)) {
    return {
      kind: 'network',
      tool: toolName,
      message: 'Network error during tool execution.',
      detail: msg,
    }
  }

  return {
    kind: 'unknown',
    tool: toolName,
    message: msg,
  }
}

export function formatStructuredToolError(err: StructuredToolError): string {
  const prefix = err.tool ? `[${err.tool}] ` : ''
  if (err.detail && err.detail !== err.message) {
    return `${prefix}${err.message} (${err.detail})`
  }
  return `${prefix}${err.message}`
}

export type FilePathValidationResult =
  | { ok: true; resolvedPath: string }
  | { ok: false; error: StructuredToolError }

/** Validate a file tool path before execution (Tovyr layer). */
export function validateTovyrFileToolPath(
  path: unknown,
  operation: FileOperationType,
  cwd: string,
  toolPermissionContext: ToolPermissionContext,
  toolName?: string,
): FilePathValidationResult {
  if (typeof path !== 'string' || path.trim() === '') {
    return {
      ok: false,
      error: {
        kind: 'path_invalid',
        tool: toolName,
        message: 'File path is required and must be a non-empty string.',
      },
    }
  }

  if (path.includes('\0')) {
    return {
      ok: false,
      error: {
        kind: 'path_invalid',
        tool: toolName,
        message: 'File path contains invalid null bytes.',
      },
    }
  }

  const result = validatePath(path, cwd, toolPermissionContext, operation)
  if (!result.allowed) {
    const reason =
      result.decisionReason?.type === 'other'
        ? result.decisionReason.reason
        : 'Path is not allowed by permission rules.'
    return {
      ok: false,
      error: {
        kind: 'path_denied',
        tool: toolName,
        message: reason,
        detail: result.resolvedPath,
      },
    }
  }

  return { ok: true, resolvedPath: result.resolvedPath }
}

/** Human-readable unified diff preview for file edits (truncated for logs). */
export function previewFileEditDiff(
  filePath: string,
  oldContent: string,
  newContent: string,
  maxLines = 40,
): string {
  const hunks = getPatchFromContents({
    filePath,
    oldContent,
    newContent,
    singleHunk: false,
  })
  if (hunks.length === 0) {
    return '(no changes)'
  }

  const lines: string[] = []
  for (const hunk of hunks) {
    lines.push(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`)
    for (const line of hunk.lines) {
      lines.push(line)
      if (lines.length >= maxLines) {
        lines.push('... (diff truncated)')
        return lines.join('\n')
      }
    }
  }
  return lines.join('\n')
}

/** Format tool input for debug logs with secret redaction. */
export function formatToolInputForLog(toolName: string, input: unknown): string {
  const raw =
    typeof input === 'string' ? input : JSON.stringify(input ?? {}, null, 0)
  const redacted = redactSecretsForToolLog(raw)
  if (redacted.length <= LOG_TRUNCATE) {
    return `[${toolName}] input: ${redacted}`
  }
  return `[${toolName}] input: ${redacted.slice(0, LOG_TRUNCATE)}… (${redacted.length} chars)`
}

/** Check shell command for destructive patterns (pre-flight, Tovyr). */
export function checkDestructiveShellCommand(command: string): StructuredToolError | null {
  const label = matchDestructiveShellCommand(command)
  if (!label) return null
  return {
    kind: 'destructive_command',
    message: `Potentially destructive command blocked (${label}). Confirm with the user before proceeding.`,
    detail: command.slice(0, 120),
  }
}

/** Normalize paths for cross-platform comparison in logs. */
export function normalizePathForLog(path: string): string {
  return path.replace(/\\/g, '/')
}

export function formatToolErrorForLog(
  toolName: string,
  error: unknown,
): string {
  const structured = classifyTovyrToolError(error, toolName)
  return redactSecretsForToolLog(formatStructuredToolError(structured))
}
