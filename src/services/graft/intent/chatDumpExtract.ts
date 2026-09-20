import { existsSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { AssistantMessage } from '../../../types/message.js'
import { getCwd } from '../../../utils/cwd.js'
import type { PermissionMode } from '../../../types/permissions.js'
import { recoverKeyValueToolCalls } from '../openaiCompat/leakedToolSyntax.js'
import { isImplementationRequest } from './buildIntent.js'
import { deriveFileNameFromPrompt } from './filenameFromPrompt.js'
import { getLastUserPromptText, hadSuccessfulFileWrite } from './implementationGuard.js'

export type ChatFileDump = {
  filePath: string
  content: string
}

const HTML_DOCTYPE_RE = /<!DOCTYPE\s+html[\s\S]*?<\/html>/i
const HTML_BODY_RE = /<html[\s>][\s\S]*?<\/html>/i

/** Model told the user to save manually instead of using Write. */
export const MANUAL_SAVE_INSTRUCTION_RE =
  /\b(notepad|save\s+as|navigate\s+to|open\s+(?:notepad|a\s+text\s+editor)|paste\s+(?:the\s+)?(?:code|content)|copy\s+(?:the\s+)?(?:code|content))\b/i

function normalizeFileName(name: string): string {
  const base = basename(name.trim().replace(/^["']|["']$/g, ''))
  return base || 'index.html'
}

function normalizeRecoveredPath(filePath: string, cwd: string): string {
  const trimmed = basename(filePath.trim().replace(/^["']|["']$/g, ''))
  try {
    const absolute = join(cwd, trimmed)
    if (filePath.includes('\\') || filePath.includes('/')) {
      const raw = filePath.trim().replace(/^["']|["']$/g, '')
      if (raw.toLowerCase().startsWith(cwd.toLowerCase())) {
        const rel = raw.slice(cwd.length).replace(/^[/\\]+/, '')
        if (rel) return basename(rel) || trimmed
      }
    }
    void absolute
  } catch {
    // fall through
  }
  return trimmed || 'index.html'
}

function filenameFromAssistantProse(text: string): string | null {
  const saveAs = text.match(
    /(?:save\s+as|filename|name\s+(?:the\s+file|it))\s*[:=]?\s*[`"']?([^\s`"'\n]+\.\w{1,12})/i,
  )
  if (saveAs?.[1]) return normalizeFileName(saveAs[1])
  return null
}

function extractHtmlContent(text: string): string | null {
  const fence = text.match(/```(?:html)?\s*\n([\s\S]*?)```/i)
  if (fence?.[1] && fence[1].trim().length >= 20) {
    return fence[1].trim()
  }
  const doctype = text.match(HTML_DOCTYPE_RE)
  if (doctype?.[0] && doctype[0].length >= 40) {
    return doctype[0].trim()
  }
  const html = text.match(HTML_BODY_RE)
  if (html?.[0] && html[0].length >= 40) {
    return html[0].trim()
  }
  return null
}

function resolveFileName(
  text: string,
  userPrompt: string | null,
  content: string,
): string {
  const leading = text.match(/^([^\s\n]+\.\w{1,12})\s*\n/i)
  if (leading?.[1]) return normalizeFileName(leading[1])

  const fromAssistant = filenameFromAssistantProse(text)
  if (fromAssistant) return fromAssistant

  const nameMatch = text.match(
    /(?:file(?:name)?|save\s+(?:as|to)|create)\s+[`"']?([^\s`"']+\.html?)/i,
  )
  if (nameMatch?.[1]) return normalizeFileName(nameMatch[1])

  if (userPrompt) {
    const fromPrompt = deriveFileNameFromPrompt(userPrompt)
    if (fromPrompt) return fromPrompt
  }

  if (/<!DOCTYPE\s+html/i.test(content) || /<html[\s>]/i.test(content)) {
    if (text.toLowerCase().includes('dashboard')) return 'dashboard.html'
    if (text.toLowerCase().includes('landing')) return 'landing_page.html'
    return 'index.html'
  }

  return 'index.html'
}

/** Pull a filename + body from assistant prose ("Filename: … Content: …"). */
export function extractChatFileDump(
  text: string,
  userPrompt: string | null = null,
): ChatFileDump | null {
  const trimmed = text.trim()
  if (!trimmed) return null

  const kv = recoverKeyValueToolCalls(trimmed)
  const write = kv.toolUses.find(t => t.name === 'Write')
  if (write?.input && typeof write.input.file_path === 'string') {
    const content =
      typeof write.input.content === 'string' ? write.input.content : ''
    if (content.length >= 8) {
      return {
        filePath: normalizeRecoveredPath(write.input.file_path, getCwd()),
        content,
      }
    }
  }

  const labeled = trimmed.match(
    /(?:\*\*)?Filename:?\*?\*?\s*([^\s\n]+)\s*\n+(?:\*\*)?Content:?\*?\*?\s*\n+([\s\S]+)/i,
  )
  if (labeled?.[1] && labeled[2]) {
    const content = labeled[2].trim()
    if (content.length >= 20) {
      return {
        filePath: normalizeFileName(labeled[1]),
        content,
      }
    }
  }

  const htmlContent = extractHtmlContent(trimmed)
  const manualSave = MANUAL_SAVE_INSTRUCTION_RE.test(trimmed)
  const creationIntent =
    /\b(create|creating|make|made|build|building|generate|generating|write|writing|save|saving|here'?s|here is)\b/i.test(
      trimmed,
    ) || manualSave
  const leadingFilename = trimmed.match(/^([^\s\n]+\.\w{1,12})\s*\n/i)

  if (
    htmlContent &&
    (creationIntent || userPrompt || leadingFilename?.[1] || filenameFromAssistantProse(trimmed))
  ) {
    return {
      filePath: resolveFileName(trimmed, userPrompt, htmlContent),
      content: htmlContent,
    }
  }

  return null
}

export function isChatFileDumpText(text: string): boolean {
  return extractChatFileDump(text) !== null
}

export function hasManualSaveInstructions(text: string): boolean {
  return MANUAL_SAVE_INSTRUCTION_RE.test(text)
}

export function isLeakedToolDisplayText(text: string): boolean {
  if (isChatFileDumpText(text)) return true
  const kv = recoverKeyValueToolCalls(text)
  return kv.toolUses.length > 0
}

const MODEL_WRITE_FAILURE_RE =
  /\b(unable to use|cannot use|can't use|failed to use|(?:is\s+)?not available).{0,60}\bWrite\b/i

const MODEL_WRITE_UNAVAILABLE_RE =
  /\bWrite\s+tool\s+(?:is\s+)?(?:not available|unavailable|disabled)/i

export function isModelWriteFailureMessage(text: string): boolean {
  return MODEL_WRITE_FAILURE_RE.test(text) || MODEL_WRITE_UNAVAILABLE_RE.test(text)
}

export function assistantMessagesContainWriteFailure(
  assistantMessages: AssistantMessage[],
): boolean {
  for (const message of assistantMessages) {
    for (const block of message.message.content) {
      if (block.type === 'text' && 'text' in block) {
        if (isModelWriteFailureMessage(block.text)) return true
      }
    }
  }
  return false
}

/** Short UI replacement when code was written to disk instead of shown in chat. */
export function formatChatDumpSavedSummary(filePath: string): string {
  return `Saved **${filePath}** to your project folder. Open that file in the editor — Graft does not paste full source in chat when code mode is active.`
}

function assistantText(assistantMessages: AssistantMessage[]): string {
  return assistantMessages
    .flatMap(m => m.message.content)
    .filter(b => b.type === 'text' && 'text' in b)
    .map(b => (b as { text: string }).text)
    .join('\n\n')
}

function allowsOverwrite(permissionMode: PermissionMode): boolean {
  return (
    permissionMode === 'acceptEdits' || permissionMode === 'bypassPermissions'
  )
}

/** When the model leaks file contents as chat text, save to disk (OpenCode-style auto-apply). */
export async function tryWriteFromChatDump(
  messages: Parameters<typeof getLastUserPromptText>[0],
  assistantMessages: AssistantMessage[],
  permissionMode: PermissionMode,
  cwd: string = getCwd(),
): Promise<{ wrote: true; path: string } | { wrote: false }> {
  const userPrompt = getLastUserPromptText(messages)
  if (!userPrompt || !isImplementationRequest(userPrompt)) {
    return { wrote: false }
  }

  if (hadSuccessfulFileWrite([...messages, ...assistantMessages])) {
    return { wrote: false }
  }

  const text = assistantText(assistantMessages)
  const dump = extractChatFileDump(text, userPrompt)
  if (!dump) return { wrote: false }

  const absolute = join(cwd, dump.filePath)
  const alreadyExists = existsSync(absolute)
  if (alreadyExists && !allowsOverwrite(permissionMode)) {
    return { wrote: false }
  }

  const content = ensureHtmlIfRequested(userPrompt, dump.content)
  await writeFile(absolute, content, 'utf8')
  return { wrote: true, path: absolute }
}

function ensureHtmlIfRequested(prompt: string, content: string): string {
  if (!/\bhtml\b/i.test(prompt)) return content
  if (/<!DOCTYPE\s+html/i.test(content) || /<html[\s>]/i.test(content)) {
    return content
  }
  const body = content.trim()
  const title =
    body.split('\n').find(l => l.trim().length > 0)?.trim() ?? 'Page'
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title.replace(/</g, '&lt;')}</title>
</head>
<body>
${body
  .split('\n')
  .map(line => `  <p>${line.trim().replace(/</g, '&lt;')}</p>`)
  .join('\n')}
</body>
</html>
`
}
