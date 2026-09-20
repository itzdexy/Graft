import { basename, isAbsolute, join, normalize, relative } from 'node:path'
import type { ToolUseBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { Message, NormalizedMessage } from '../../../types/message.js'
import { getCwd } from '../../../utils/cwd.js'
import { isHumanTurn } from '../../../utils/messagePredicates.js'
import { graftWriteVerifiedOnDisk } from '../intent/implementationGuard.js'
import { getLastUserPromptText } from '../intent/implementationGuard.js'
import type { MessageLookups } from '../../../utils/messages.js'
import { filterGraftAssistantDisplayText } from './chatTextFilter.js'

export type GraftTranscriptContextValue = {
  hiddenToolUseIds: Set<string>
  visibleWritePaths: Set<string>
  /** Consecutive assistant text rows with identical display text (weak-model duplicate blocks). */
  hiddenDuplicateAssistantTextUuids: Set<string>
}

function assistantTextDisplayKey(
  message: Message | NormalizedMessage,
): string | null {
  if (message.type !== 'assistant') return null
  const block = message.message.content[0]
  if (!block || block.type !== 'text' || !('text' in block)) return null
  const display = filterGraftAssistantDisplayText(block.text).trim()
  return display || null
}

/**
 * Streaming emits one assistant row per content_block_stop. Weak models sometimes
 * repeat the same narrative in back-to-back (or tool-interrupted) text blocks —
 * hide every duplicate copy within the current user turn.
 *
 * Progress / system / tool-result rows must NOT reset the chain, or duplicates
 * that land around them still render twice as full "Graft" turns.
 */
export function computeHiddenDuplicateGraftAssistantTextUuids(
  messages: (Message | NormalizedMessage)[],
): Set<string> {
  const hidden = new Set<string>()
  const seenInTurn = new Set<string>()

  for (const message of messages) {
    if (isHumanTurn(message as Message)) {
      seenInTurn.clear()
      continue
    }
    const key = assistantTextDisplayKey(message)
    if (!key) continue
    if (seenInTurn.has(key)) {
      hidden.add(message.uuid)
    } else {
      seenInTurn.add(key)
    }
  }

  return hidden
}

/** Last visible assistant prose in the transcript (for dock streaming dedup). */
export function lastGraftCommittedAssistantDisplayText(
  messages: Message[],
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const key = assistantTextDisplayKey(messages[i]!)
    if (key) return key
  }
  return null
}

const FILE_WRITE_TOOLS = new Set(['Write', 'Edit'])

/** Stable write key relative to project cwd (avoids basename collisions). */
export function normalizeGraftWritePath(
  filePath: string,
  cwd: string = getCwd(),
): string {
  const trimmed = filePath.trim().replace(/\\/g, '/')
  if (!trimmed) return ''
  try {
    const abs = isAbsolute(trimmed)
      ? normalize(trimmed)
      : normalize(join(cwd, trimmed))
    const rel = relative(cwd, abs).replace(/\\/g, '/')
    if (rel && !rel.startsWith('..')) return rel.toLowerCase()
  } catch {
    // fall through
  }
  return trimmed.toLowerCase()
}

function writeToolKey(
  block: ToolUseBlockParam,
  cwd: string,
): string | null {
  if (!FILE_WRITE_TOOLS.has(block.name)) return null
  const input = block.input as Record<string, unknown>
  const file_path =
    typeof input.file_path === 'string' ? input.file_path : null
  if (!file_path) return null
  const key = normalizeGraftWritePath(file_path, cwd)
  if (!key) return null
  return `${block.name}:${key}`
}

function scoreWriteTool(
  toolUseId: string,
  filePath: string,
  lookups: MessageLookups,
  cwd: string,
  userPrompt: string | null,
): number {
  if (graftWriteVerifiedOnDisk(filePath, cwd, userPrompt)) return 4
  if (!lookups.erroredToolUseIDs.has(toolUseId)) return 2
  return 0
}

/**
 * Hide duplicate or superseded Write/Edit rows in the Graft transcript.
 * Keeps the best row per file (on disk > success > last attempt).
 */
export function computeHiddenGraftWriteToolIds(
  messages: (Message | NormalizedMessage)[],
  lookups: MessageLookups,
  cwd: string = getCwd(),
): Set<string> {
  const hidden = new Set<string>()
  const userPrompt = getLastUserPromptText(messages as Message[])
  const bestByKey = new Map<string, { id: string; score: number }>()

  for (const message of messages) {
    if (message.type !== 'assistant') continue
    for (const block of message.message.content) {
      if (block.type !== 'tool_use') continue
      const key = writeToolKey(block, cwd)
      if (!key) continue
      const file_path =
        typeof (block.input as Record<string, unknown>).file_path === 'string'
          ? String((block.input as Record<string, unknown>).file_path)
          : ''
      const score = scoreWriteTool(block.id, file_path, lookups, cwd, userPrompt)
      const prev = bestByKey.get(key)
      if (!prev || score > prev.score || (score === prev.score && score >= 2)) {
        if (prev) hidden.add(prev.id)
        bestByKey.set(key, { id: block.id, score })
      } else {
        hidden.add(block.id)
      }
    }
  }

  const landingSatisfied =
    userPrompt &&
    /\blanding\s*page\b/i.test(userPrompt) &&
    (graftWriteVerifiedOnDisk('landing_page.html', cwd, userPrompt) ||
      graftWriteVerifiedOnDisk('index.html', cwd, userPrompt))

  if (landingSatisfied) {
    for (const message of messages) {
      if (message.type !== 'assistant') continue
      for (const block of message.message.content) {
        if (block.type !== 'tool_use' || block.name !== 'Write') continue
        const fp =
          typeof (block.input as Record<string, unknown>).file_path === 'string'
            ? basename(String((block.input as Record<string, unknown>).file_path))
            : ''
        if (
          (fp === 'index.html' || fp === 'landing_page.html') &&
          lookups.erroredToolUseIDs.has(block.id)
        ) {
          hidden.add(block.id)
        }
      }
    }
  }

  const docsSatisfied =
    userPrompt &&
    /\b(docs?\s*(site|website)|documentation\s*(site|website)|full\s+docs|graft\s+docs)\b/i.test(
      userPrompt,
    ) &&
    graftWriteVerifiedOnDisk('docs/index.html', cwd, userPrompt)

  if (docsSatisfied) {
    for (const message of messages) {
      if (message.type !== 'assistant') continue
      for (const block of message.message.content) {
        if (block.type !== 'tool_use' || block.name !== 'Write') continue
        const fp =
          typeof (block.input as Record<string, unknown>).file_path === 'string'
            ? String((block.input as Record<string, unknown>).file_path)
                .replace(/\\/g, '/')
                .toLowerCase()
            : ''
        if (
          (fp.endsWith('docs/index.html') || fp === 'index.html') &&
          lookups.erroredToolUseIDs.has(block.id)
        ) {
          hidden.add(block.id)
        }
      }
    }
  }

  return hidden
}

/** Build transcript collapse state for Graft UI (hidden tool rows + visible write paths). */
export function buildGraftTranscriptContext(
  messages: (Message | NormalizedMessage)[],
  lookups: MessageLookups,
  cwd: string = getCwd(),
): GraftTranscriptContextValue {
  const hiddenToolUseIds = computeHiddenGraftWriteToolIds(messages, lookups, cwd)
  const visibleWritePaths = new Set<string>()

  for (const message of messages) {
    if (message.type !== 'assistant') continue
    for (const block of message.message.content) {
      if (block.type !== 'tool_use') continue
      if (!FILE_WRITE_TOOLS.has(block.name)) continue
      if (hiddenToolUseIds.has(block.id)) continue
      const file_path =
        typeof (block.input as Record<string, unknown>).file_path === 'string'
          ? normalizeGraftWritePath(
              String((block.input as Record<string, unknown>).file_path),
              cwd,
            )
          : null
      if (file_path) visibleWritePaths.add(file_path)
    }
  }

  const hiddenDuplicateAssistantTextUuids =
    computeHiddenDuplicateGraftAssistantTextUuids(messages)

  return {
    hiddenToolUseIds,
    visibleWritePaths,
    hiddenDuplicateAssistantTextUuids,
  }
}

export function graftWritePathVisible(
  filePath: string,
  visibleWritePaths: Set<string>,
  cwd: string = getCwd(),
): boolean {
  const key = normalizeGraftWritePath(filePath, cwd)
  if (key && visibleWritePaths.has(key)) return true
  const base = basename(filePath).toLowerCase()
  return visibleWritePaths.has(base)
}
