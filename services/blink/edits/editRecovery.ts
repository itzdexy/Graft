import { existsSync, readFileSync } from 'node:fs'
import { FILE_UNEXPECTEDLY_MODIFIED_ERROR } from '../../../tools/FileEditTool/constants.js'
import { FILE_NOT_FOUND_CWD_NOTE } from '../../../utils/file.js'
import { expandPath } from '../../../utils/path.js'
import {
  applyAiderBlocks,
  hasAiderBlockMarkers,
  parseAiderBlocks,
} from './aiderBlocks.js'
import { AIDER_SEARCH_MISS_PREFIX } from './aiderRetry.js'

const MIN_RECOVERABLE_BYTES = 8

export type FailedEditInput = {
  file_path?: string
  old_string?: string
  new_string?: string
}

/** Pull the human-readable error out of a tool_result string. */
export function extractEditErrorText(result: string): string | null {
  const tagMatch = result.match(/<tool_use_error>([\s\S]*?)<\/tool_use_error>/)
  if (tagMatch?.[1]) {
    return tagMatch[1].trim()
  }
  const trimmed = result.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Short Blink-facing hint for a failed Edit (non-verbose UI). */
export function summarizeEditToolError(errorMessage: string): string {
  if (errorMessage.includes('File has not been read yet')) {
    return 'Read the file first'
  }
  if (
    errorMessage.includes(FILE_NOT_FOUND_CWD_NOTE) ||
    errorMessage.includes('File does not exist')
  ) {
    return 'File missing — use Write for new files'
  }
  if (errorMessage.includes('String to replace not found')) {
    return 'Text not found in file'
  }
  if (errorMessage.includes('Cannot create new file')) {
    return 'File already exists'
  }
  if (errorMessage.includes('Invalid SEARCH/REPLACE')) {
    return 'Invalid search/replace blocks'
  }
  if (
    errorMessage.includes(AIDER_SEARCH_MISS_PREFIX) ||
    errorMessage.includes('SEARCH text not found') ||
    errorMessage.includes('No blocks matched')
  ) {
    return 'Search block did not match'
  }
  if (
    errorMessage.includes(FILE_UNEXPECTEDLY_MODIFIED_ERROR) ||
    errorMessage.includes('modified since read')
  ) {
    return 'File changed — read again'
  }
  if (errorMessage.includes('replace_all')) {
    return 'Multiple matches — set replace_all'
  }
  if (errorMessage.includes('No changes to make')) {
    return 'File already matches — no edit needed'
  }
  if (
    errorMessage.includes('git.exe') ||
    (errorMessage.includes('Second argument must be') &&
      errorMessage.includes('array of arguments'))
  ) {
    return 'Git checkpoint failed — edit not blocked'
  }
  if (
    errorMessage.includes('Second argument must be') &&
    (errorMessage.includes('string') || errorMessage.includes('regular expression'))
  ) {
    return 'Invalid edit arguments — use strings for old_string and new_string'
  }

  const first = errorMessage.split('\n')[0]?.trim() ?? ''
  if (first.length > 0 && first.length <= 56) return first
  if (first.length > 56) return `${first.slice(0, 53)}...`
  return 'Edit failed'
}

function looksLikeFullFileContent(text: string): boolean {
  const t = text.trim()
  if (t.length < MIN_RECOVERABLE_BYTES) return false
  return (
    t.startsWith('<!') ||
    t.startsWith('<html') ||
    t.includes('<!DOCTYPE') ||
    t.startsWith('# ') ||
    /^import |^export |^function |^const |^class |^fn main/.test(t)
  )
}

function contentFromAiderBlocks(
  old_string: string,
  new_string: string,
  baseContent: string,
): string | null {
  const source = hasAiderBlockMarkers(old_string) ? old_string : new_string
  const blocks = parseAiderBlocks(source)
  if (!blocks.length) return null

  if (blocks.every(b => b.search === '')) {
    const joined = blocks.map(b => b.replace).join('\n')
    return joined.trim().length >= MIN_RECOVERABLE_BYTES ? joined : null
  }

  const { content, applied } = applyAiderBlocks(baseContent, blocks)
  return applied > 0 ? content : null
}

/**
 * Derive file contents from a failed Edit tool_use so Blink can still deliver
 * the user's implementation request when the model used Edit instead of Write.
 */
export function deriveContentFromFailedEdit(
  input: FailedEditInput,
  cwd: string,
): { filePath: string; content: string } | null {
  const file_path = input.file_path
  const old_string = input.old_string ?? ''
  const new_string = input.new_string ?? ''
  if (!file_path || new_string.trim().length < MIN_RECOVERABLE_BYTES) {
    return null
  }

  const absolute = expandPath(file_path, cwd)
  const fileExists = existsSync(absolute)

  if (old_string === '') {
    return { filePath: file_path, content: new_string }
  }

  if (
    hasAiderBlockMarkers(old_string) ||
    hasAiderBlockMarkers(new_string)
  ) {
    const base = fileExists ? readFileSync(absolute, 'utf8') : ''
    const content = contentFromAiderBlocks(old_string, new_string, base)
    if (content) return { filePath: file_path, content }
  }

  if (!fileExists) {
    if (looksLikeFullFileContent(new_string)) {
      return { filePath: file_path, content: new_string }
    }
    return null
  }

  try {
    const onDisk = readFileSync(absolute, 'utf8')
    if (onDisk.trim().length === 0 && looksLikeFullFileContent(new_string)) {
      return { filePath: file_path, content: new_string }
    }
  } catch {
    return null
  }

  return null
}
