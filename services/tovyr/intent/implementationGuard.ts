import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { AssistantMessage, Message } from '../../../types/message.js'
import type { PermissionMode } from '../../../types/permissions.js'
import { getContentText } from '../../../utils/messages.js'
import { expandPath } from '../../../utils/path.js'
import { getCwd } from '../../../utils/cwd.js'
import { deriveContentFromFailedEdit } from '../edits/editRecovery.js'
import { FILE_EDIT_TOOL_NAME } from '../../../tools/FileEditTool/constants.js'
import { FILE_WRITE_TOOL_NAME } from '../../../tools/FileWriteTool/prompt.js'
import { tovyrTierForMode } from '../permissions/tiers.js'
import {
  hasManualSaveInstructions,
  tryWriteFromChatDump,
} from './chatDumpExtract.js'
import { tryImplementationFilesystemFallback, isTovyrGenericStarterMarkup, isAgentShowcaseRequest } from './implementationFallback.js'
import { isImplementationRequest } from './buildIntent.js'
import { deriveFileNameFromPrompt } from './filenameFromPrompt.js'

export const MAX_IMPLEMENTATION_RETRY_ROUNDS = 2

const MIN_USEFUL_FILE_BYTES = 32

/** True when a path exists and has non-trivial content (not an empty failed write). */
export function isUsefulFileOnDisk(absolutePath: string): boolean {
  try {
    if (!existsSync(absolutePath)) return false
    const st = statSync(absolutePath)
    return st.isFile() && st.size >= MIN_USEFUL_FILE_BYTES
  } catch {
    return false
  }
}

/** True when an on-disk file actually matches what the user asked for. */
export function diskFileSatisfiesPrompt(
  absolutePath: string,
  userPrompt: string,
): boolean {
  if (!isUsefulFileOnDisk(absolutePath)) return false
  try {
    const content = readFileSync(absolutePath, 'utf8')
    if (isAgentShowcaseRequest(userPrompt)) {
      if (isTovyrGenericStarterMarkup(content)) return false
      return (
        content.toLowerCase().includes('showcase') ||
        content.toLowerCase().includes('featured agents')
      )
    }
    if (isTovyrGenericStarterMarkup(content) && /\b(showcase|portfolio)\b/i.test(userPrompt)) {
      return false
    }
    return true
  } catch {
    return false
  }
}

function pathMatchesImplementationRequest(
  absolutePath: string,
  userPrompt?: string | null,
): boolean {
  if (!isUsefulFileOnDisk(absolutePath)) return false
  const prompt = userPrompt?.trim()
  if (!prompt) return true
  return diskFileSatisfiesPrompt(absolutePath, prompt)
}

/**
 * True when the Write target (or a known alternate for this request) exists on disk
 * and matches the user's implementation request.
 */
export function tovyrWriteVerifiedOnDisk(
  filePath: string,
  cwd: string = getCwd(),
  userPrompt?: string | null,
): boolean {
  if (pathMatchesImplementationRequest(expandPath(filePath, cwd), userPrompt)) {
    return true
  }

  const base = basename(filePath)
  if (base === 'main.rs' || /\.rs$/i.test(base)) {
    const srcMain = join(cwd, 'src', 'main.rs')
    const cargo = join(cwd, 'Cargo.toml')
    return (
      pathMatchesImplementationRequest(srcMain, userPrompt) && existsSync(cargo)
    )
  }

  const prompt = userPrompt ?? ''
  if (/\blanding\s*page\b/i.test(prompt)) {
    return ['landing_page.html', 'index.html'].some(name =>
      pathMatchesImplementationRequest(join(cwd, name), userPrompt),
    )
  }
  if (/\bdashboard\b/i.test(prompt)) {
    return ['dashboard.html', 'index.html'].some(name =>
      pathMatchesImplementationRequest(join(cwd, name), userPrompt),
    )
  }
  if (/\bhtml\b/i.test(prompt) && (base === 'index.html' || base === 'landing_page.html')) {
    return ['index.html', 'landing_page.html'].some(name =>
      pathMatchesImplementationRequest(join(cwd, name), userPrompt),
    )
  }
  if (
    /\b(docs?\s*(site|website)|documentation\s*(site|website)|full\s+docs|tovyr\s+docs)\b/i.test(
      prompt,
    )
  ) {
    return pathMatchesImplementationRequest(join(cwd, 'docs', 'index.html'), userPrompt)
  }
  return false
}

/** @deprecated Use tovyrWriteVerifiedOnDisk */
export function writeFailureSatisfiedOnDisk(
  filePath: string,
  cwd: string = getCwd(),
  userPrompt?: string | null,
): boolean {
  return tovyrWriteVerifiedOnDisk(filePath, cwd, userPrompt)
}

export function implementationDeliveredOnDisk(
  messages: Message[],
  assistantMessages: AssistantMessage[] = [],
  extraMessages: Message[] = [],
  cwd: string = getCwd(),
): boolean {
  const allMessages = mergeMessagesForRecovery(
    messages,
    assistantMessages,
    extraMessages,
  )
  if (hadSuccessfulFileWrite(allMessages, cwd)) return true

  const userPrompt = getLastUserPromptText(messages)
  if (!userPrompt) return false

  const target = deriveFileNameFromPrompt(userPrompt)
  if (target && diskFileSatisfiesPrompt(join(cwd, target), userPrompt)) {
    return true
  }

  return tovyrWriteVerifiedOnDisk(target ?? 'index.html', cwd, userPrompt)
}

export function mergeMessagesForRecovery(
  messages: Message[],
  assistantMessages: AssistantMessage[],
  extraMessages: Message[] = [],
): Message[] {
  return [...messages, ...assistantMessages, ...extraMessages]
}

/** On in Tovyr unless TOVYR_IMPLEMENTATION_GUARD=0. */
export function isImplementationGuardEnabled(): boolean {
  const v = process.env.TOVYR_IMPLEMENTATION_GUARD?.trim().toLowerCase()
  if (v === '0' || v === 'false' || v === 'no') return false
  return true
}

const FILE_WRITE_TOOLS = new Set([FILE_WRITE_TOOL_NAME, FILE_EDIT_TOOL_NAME])

export function toolBatchHadFailedFileWrite(
  toolUseBlocks: { id: string; name: string }[],
  toolResults: Message[],
): boolean {
  const errored = new Set<string>()
  for (const message of toolResults) {
    if (message.type !== 'user' || !Array.isArray(message.message.content)) {
      continue
    }
    for (const block of message.message.content) {
      if (
        typeof block === 'object' &&
        block !== null &&
        'type' in block &&
        block.type === 'tool_result' &&
        'tool_use_id' in block &&
        block.is_error
      ) {
        errored.add(block.tool_use_id as string)
      }
    }
  }
  return toolUseBlocks.some(
    block => FILE_WRITE_TOOLS.has(block.name) && errored.has(block.id),
  )
}

function toolResultsById(messages: Message[]): Map<string, ToolResultBlockParam> {
  const map = new Map<string, ToolResultBlockParam>()
  for (const message of messages) {
    if (message.type !== 'user' || !Array.isArray(message.message.content)) {
      continue
    }
    for (const block of message.message.content) {
      if (
        typeof block === 'object' &&
        block !== null &&
        'type' in block &&
        block.type === 'tool_result' &&
        'tool_use_id' in block
      ) {
        map.set(block.tool_use_id as string, block as ToolResultBlockParam)
      }
    }
  }
  return map
}

/** Last visible (non-meta) user prompt in the conversation. */
export function getLastUserPromptText(messages: Message[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message.type !== 'user' || message.isMeta) continue
    return getContentText(message.message.content)
  }
  return null
}

/** True when a Write or Edit tool_use completed and the file exists on disk. */
export function hadSuccessfulFileWrite(
  messages: Message[],
  cwd: string = getCwd(),
): boolean {
  const results = toolResultsById(messages)
  const userPrompt = getLastUserPromptText(messages)
  for (const message of messages) {
    if (message.type !== 'assistant') continue
    for (const block of message.message.content) {
      if (block.type !== 'tool_use' || !FILE_WRITE_TOOLS.has(block.name)) {
        continue
      }
      const result = results.get(block.id)
      if (!result || result.is_error) continue
      const input = block.input as Record<string, unknown>
      const file_path =
        typeof input.file_path === 'string' ? input.file_path : null
      if (
        file_path &&
        tovyrWriteVerifiedOnDisk(file_path, cwd, userPrompt)
      ) {
        return true
      }
    }
  }
  return false
}

/** True when a Write/Edit tool_use returned an error result. */
export function hadFailedFileWrite(messages: Message[]): boolean {
  const results = toolResultsById(messages)
  for (const message of messages) {
    if (message.type !== 'assistant') continue
    for (const block of message.message.content) {
      if (block.type !== 'tool_use' || !FILE_WRITE_TOOLS.has(block.name)) {
        continue
      }
      const result = results.get(block.id)
      if (result?.is_error) return true
    }
  }
  return false
}

/** Re-apply content from a failed or ghost-success Write when the file is missing on disk. */
export async function tryRecoverFromFailedWriteTool(
  messages: Message[],
  cwd: string = getCwd(),
): Promise<{ wrote: true; path: string } | { wrote: false }> {
  const results = toolResultsById(messages)
  const userPrompt = getLastUserPromptText(messages)
  let last: { filePath: string; content: string } | null = null
  for (const message of messages) {
    if (message.type !== 'assistant') continue
    for (const block of message.message.content) {
      if (block.type !== 'tool_use' || !FILE_WRITE_TOOLS.has(block.name)) {
        continue
      }
      const result = results.get(block.id)
      if (!result) continue
      const input = block.input as Record<string, unknown>
      let file_path: string | null = null
      let content = ''

      if (block.name === FILE_WRITE_TOOL_NAME) {
        file_path =
          typeof input.file_path === 'string' ? input.file_path : null
        content = typeof input.content === 'string' ? input.content : ''
      } else if (block.name === FILE_EDIT_TOOL_NAME) {
        const derived = deriveContentFromFailedEdit(
          {
            file_path:
              typeof input.file_path === 'string' ? input.file_path : undefined,
            old_string:
              typeof input.old_string === 'string'
                ? input.old_string
                : undefined,
            new_string:
              typeof input.new_string === 'string'
                ? input.new_string
                : undefined,
          },
          cwd,
        )
        if (derived) {
          file_path = derived.filePath
          content = derived.content
        }
      }

      if (!file_path || content.trim().length < 8) continue

      const absolute = expandPath(file_path, cwd)
      if (tovyrWriteVerifiedOnDisk(file_path, cwd, userPrompt)) continue

      last = { filePath: file_path, content }
    }
  }
  if (!last) return { wrote: false }

  const absolute = expandPath(last.filePath, cwd)
  if (existsSync(absolute) && isUsefulFileOnDisk(absolute)) {
    return { wrote: true, path: absolute }
  }
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, last.content, 'utf8')
  return { wrote: true, path: absolute }
}

export function buildImplementationNudgeMessage(userPrompt: string): string {
  return [
    'TOVYR_IMPLEMENTATION_INCOMPLETE: The user asked for files on disk but no Write/Edit tool has succeeded yet.',
    '',
    `User request: ${userPrompt.slice(0, 500)}`,
    '',
    'Call the **Write** tool now with the full file contents (use sensible names like index.html).',
    'For new files you may also use **Edit** with `old_string` empty and the full file in `new_string`.',
    'Do **not** use Bash to create files in code mode — shell file commands fail or need extra approval on Windows.',
    'Do **not** reply with prose only or paste file contents in chat. Invoke Write in this turn.',
  ].join('\n')
}

/**
 * When the user asked to build something but the model ended the turn without a
 * successful Write/Edit, inject a meta nudge and continue the query loop.
 */
export function shouldNudgeImplementationComplete(
  messages: Message[],
  assistantMessages: AssistantMessage[],
  permissionMode: PermissionMode,
): { nudge: true; userPrompt: string } | { nudge: false } {
  const tier = tovyrTierForMode(permissionMode)
  if (tier === 'read_only') return { nudge: false }

  const userPrompt = getLastUserPromptText(messages)
  if (!userPrompt || !isImplementationRequest(userPrompt)) {
    return { nudge: false }
  }

  const allMessages = [...messages, ...assistantMessages]
  if (hadSuccessfulFileWrite(allMessages)) {
    return { nudge: false }
  }

  const lastAssistant = assistantMessages.at(-1)
  if (!lastAssistant || lastAssistant.isApiErrorMessage) {
    return { nudge: false }
  }

  const assistantText = lastAssistant.message.content
    .filter(b => b.type === 'text' && 'text' in b)
    .map(b => (b as { text: string }).text)
    .join('\n')
  const REFUSAL_RE =
    /\b(didn'?t create|cannot create|can'?t create|requires multiple tools|guide you through|don'?t have (?:access|the ability)|unable to (?:create|build)|without (?:using|calling) tools)\b/i
  if (REFUSAL_RE.test(assistantText)) {
    return { nudge: true, userPrompt }
  }
  if (hasManualSaveInstructions(assistantText)) {
    return { nudge: true, userPrompt }
  }

  const endedWithToolUse = lastAssistant.message.content.some(
    block => block.type === 'tool_use',
  )
  if (endedWithToolUse) {
    return { nudge: false }
  }

  return { nudge: true, userPrompt }
}

export type TovyrFileRecoverySource = 'chat_dump' | 'starter'

/** User-facing notice after automatic file recovery. */
export function formatTovyrRecoveryNotice(
  absolutePath: string,
  source: TovyrFileRecoverySource,
  cwd?: string,
  variant: 'default' | 'after_failed_write' | 'after_nudge_exhausted' = 'default',
): string {
  const root = cwd ?? getCwd()
  const normalized = absolutePath.replace(/\\/g, '/')
  const cwdNorm = root.replace(/\\/g, '/')
  const rel = normalized.startsWith(cwdNorm)
    ? normalized.slice(cwdNorm.length).replace(/^\//, '')
    : basename(absolutePath)
  const label = rel || basename(absolutePath)

  let body: string
  if (/\/docs\/index\.html$/i.test(normalized) || label === 'docs/index.html') {
    body =
      source === 'chat_dump'
        ? `Tovyr saved the docs site to **${label}** — open it in your browser.`
        : `Tovyr wrote a starter docs site to **${label}** — open it in your browser, or run \`/guide\` to regenerate.`
  } else if (/\.html?$/i.test(label)) {
    body =
      source === 'chat_dump'
        ? `Tovyr saved the page to **${label}** — open it in your browser.`
        : `Saved **${label}** from your prompt — open it in your browser to review.`
  } else {
    body =
      source === 'chat_dump'
        ? `Tovyr saved the code from chat to **${label}** in your project folder. Open it in your editor.`
        : `Tovyr saved a starter **${label}** in your project folder — open it and ask Tovyr to customize it.`
  }

  if (variant === 'after_failed_write') {
    return `Write failed, but ${body.charAt(0).toLowerCase()}${body.slice(1)}`
  }
  if (variant === 'after_nudge_exhausted') {
    return `Model did not call Write after ${MAX_IMPLEMENTATION_RETRY_ROUNDS} nudges. ${body}`
  }
  if (variant === 'default' && source === 'starter') {
    return `The model could not call Write reliably. ${body.charAt(0).toLowerCase()}${body.slice(1)}`
  }
  return body
}

/**
 * Save leaked chat output or a starter scaffold when the model fails to call
 * Write on a build request. Runs whenever a build request is still undelivered.
 */
export async function tryTovyrImplementationFileRecovery(
  messages: Message[],
  assistantMessages: AssistantMessage[],
  permissionMode: PermissionMode,
  extraMessages: Message[] = [],
  cwd: string = getCwd(),
  options: { allowStarterFallback?: boolean } = {},
): Promise<
  | { wrote: true; path: string; source: TovyrFileRecoverySource }
  | { wrote: false }
> {
  const allowStarterFallback = options.allowStarterFallback !== false
  const userPrompt = getLastUserPromptText(messages)
  if (!userPrompt || !isImplementationRequest(userPrompt)) {
    return { wrote: false }
  }

  if (implementationDeliveredOnDisk(messages, assistantMessages, extraMessages, cwd)) {
    return { wrote: false }
  }

  const chatDumpWrite = await tryWriteFromChatDump(
    messages,
    assistantMessages,
    permissionMode,
    cwd,
  )
  if (chatDumpWrite.wrote) {
    return { wrote: true, path: chatDumpWrite.path, source: 'chat_dump' }
  }

  const failedToolWrite = await tryRecoverFromFailedWriteTool(
    mergeMessagesForRecovery(messages, assistantMessages, extraMessages),
    cwd,
  )
  if (failedToolWrite.wrote) {
    return { wrote: true, path: failedToolWrite.path, source: 'chat_dump' }
  }

  if (!allowStarterFallback) {
    return { wrote: false }
  }

  const fallback = await tryImplementationFilesystemFallback(userPrompt, cwd)
  if (fallback.wrote) {
    return { wrote: true, path: fallback.path, source: 'starter' }
  }

  return { wrote: false }
}
