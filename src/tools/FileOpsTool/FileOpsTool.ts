import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { getSessionId } from '../../bootstrap/state.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { expandPath } from '../../utils/path.js'
import { checkWritePermissionForTool } from '../../utils/permissions/filesystem.js'
import type { PermissionDecision } from '../../utils/permissions/PermissionResult.js'
import { moveToTrash, trashRoot } from './trash.js'

export const FILE_OPS_TOOL_NAME = 'FileOps'

const inputSchema = lazySchema(() =>
  z.strictObject({
    operation: z
      .enum(['move', 'copy', 'delete', 'mkdir'])
      .describe('What to do.'),
    path: z
      .string()
      .min(1)
      .describe('Absolute path to operate on (the source, for move/copy).'),
    destination: z
      .string()
      .optional()
      .describe('Absolute destination path. Required for move and copy.'),
  }),
)

const outputSchema = lazySchema(() =>
  z.object({
    operation: z.string(),
    path: z.string(),
    destination: z.string().optional(),
    /** Where a deleted path was moved, so it can be restored. */
    trashedTo: z.string().optional(),
  }),
)

function copyDirSync(from: string, to: string): void {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const src = join(from, entry.name)
    const dst = join(to, entry.name)
    if (entry.isDirectory()) copyDirSync(src, dst)
    else copyFileSync(src, dst)
  }
}

/**
 * Move, copy, delete and mkdir as a first-class tool.
 *
 * This was the gap in the file toolset: Read, Write and Edit are tools, but
 * deleting or renaming a file meant shelling out. That put the most
 * irreversible filesystem operations on a path with different semantics per
 * shell (rm under Git Bash, Remove-Item under PowerShell), no structured
 * result, and no way back. Here they go through the same write-permission
 * check as Write, and delete is recoverable.
 */
export const FileOpsTool = buildTool({
  name: FILE_OPS_TOOL_NAME,
  searchHint: 'move, copy, delete or create directories',
  maxResultSizeChars: 10_000,
  isConcurrencySafe() {
    return false
  },
  isReadOnly() {
    return false
  },
  isDestructive(input) {
    return input.operation === 'delete' || input.operation === 'move'
  },
  userFacingName() {
    return 'FileOps'
  },
  get inputSchema() {
    return inputSchema()
  },
  get outputSchema() {
    return outputSchema()
  },
  toAutoClassifierInput(input) {
    const target = input.destination ? ` -> ${input.destination}` : ''
    return `${input.operation} ${input.path}${target}`
  },
  getPath(input): string {
    // The permission check keys on the path being written. For move and copy
    // that is the destination; for delete and mkdir it is the path itself.
    return input.operation === 'move' || input.operation === 'copy'
      ? (input.destination ?? input.path)
      : input.path
  },
  backfillObservableInput(input) {
    // Match FileWriteTool: expand before any allowlist sees the value, so a
    // rule cannot be sidestepped with a tilde or a relative path.
    if (typeof input.path === 'string') input.path = expandPath(input.path)
    if (typeof input.destination === 'string') {
      input.destination = expandPath(input.destination)
    }
  },
  async checkPermissions(input, context): Promise<PermissionDecision> {
    const appState = context.getAppState()
    return checkWritePermissionForTool(
      FileOpsTool,
      input,
      appState.toolPermissionContext,
    )
  },
  renderToolUseMessage(input) {
    const { operation, path, destination } = input
    if (!operation || !path) return 'FileOps'
    return destination
      ? `${operation} ${path} -> ${destination}`
      : `${operation} ${path}`
  },
  async description(input) {
    return `${input.operation} ${input.path}`
  },
  getActivityDescription(input) {
    // Partial and possibly undefined: called while the call is still
    // streaming, before `operation` and `path` have arrived.
    const verbs: Record<string, string> = {
      move: 'Moving',
      copy: 'Copying',
      delete: 'Deleting',
      mkdir: 'Creating directory',
    }
    const verb = verbs[input?.operation ?? ''] ?? 'Changing'
    return input?.path ? `${verb} ${input.path}` : 'File operation'
  },
  async prompt() {
    return [
      'Move, copy, delete, or create directories.',
      '',
      'Use this instead of shelling out to rm, mv, cp or mkdir. It behaves the',
      'same way regardless of which shell is available, returns a structured',
      'result, and goes through the normal write-permission checks.',
      '',
      '- move   - rename or relocate. Requires "destination".',
      '- copy   - duplicate. Requires "destination".',
      '- delete - moves the path into a per-session trash directory rather',
      '           than unlinking it, so a mistake can be undone. The result',
      '           says where it went.',
      '- mkdir  - create a directory and any missing parents.',
      '',
      'Paths must be absolute. move and copy will not overwrite an existing',
      'destination; delete the conflicting path first if that is what you',
      'intend.',
    ].join('\n')
  },
  async validateInput(input) {
    const { operation, path, destination } = input
    if ((operation === 'move' || operation === 'copy') && !destination) {
      return {
        result: false,
        message: `A destination is required for ${operation}.`,
        errorCode: 1,
      }
    }
    if (operation !== 'mkdir' && !existsSync(resolve(path))) {
      return {
        result: false,
        message: `Path does not exist: ${path}`,
        errorCode: 2,
      }
    }
    if (destination && existsSync(resolve(destination))) {
      // Silently clobbering the destination would make move and copy as
      // irreversible as the rm this tool exists to replace.
      return {
        result: false,
        message: `Destination already exists: ${destination}. Delete it first if you mean to replace it.`,
        errorCode: 3,
      }
    }
    return { result: true }
  },
  async call(input) {
    const { operation } = input
    const path = resolve(input.path)
    const destination = input.destination
      ? resolve(input.destination)
      : undefined

    if (operation === 'mkdir') {
      mkdirSync(path, { recursive: true })
      return { data: { operation, path } }
    }
    if (operation === 'delete') {
      const trashedTo = moveToTrash(path, getSessionId())
      return { data: { operation, path, trashedTo } }
    }
    if (!destination) {
      throw new Error(`${operation} requires a destination`)
    }
    mkdirSync(dirname(destination), { recursive: true })
    if (operation === 'move') {
      renameSync(path, destination)
    } else if (statSync(path).isDirectory()) {
      copyDirSync(path, destination)
    } else {
      copyFileSync(path, destination)
    }
    return { data: { operation, path, destination } }
  },
  mapToolResultToToolResultBlockParam(output, toolUseID) {
    const lines = [`${output.operation}: ${output.path}`]
    if (output.destination) lines.push(`-> ${output.destination}`)
    if (output.trashedTo) {
      lines.push(
        `Moved to trash: ${output.trashedTo}`,
        `Restore it with FileOps move; the session trash lives at ${trashRoot(getSessionId())}`,
      )
    }
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: lines.join('\n'),
    }
  },
} satisfies Parameters<typeof buildTool>[0])
