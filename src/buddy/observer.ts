import { getCompanion } from './companion.js'
import { isTovyrRuntime } from './tovyrBuddy.js'

type ReactionCallback = (reaction: string) => void

interface MessageType {
  type: string
  message?: {
    content?: string | Array<{ type: string; text?: string; name?: string }>
  }
}

function isAssistantMessage(msg: MessageType): boolean {
  return msg?.type === 'assistant'
}

function isUserMessage(msg: MessageType): boolean {
  return msg?.type === 'user'
}

function extractAssistantText(msg: MessageType): string {
  if (!isAssistantMessage(msg)) return ''
  const raw = msg.message?.content
  if (typeof raw === 'string') return raw
  const content = Array.isArray(raw) ? raw : []
  return content
    .filter((block: { type: string; text?: string }): block is { type: 'text'; text: string } =>
      block.type === 'text' && typeof block.text === 'string')
    .map((block: { text: string }) => block.text)
    .join('\n')
}

function extractToolUses(msg: MessageType): string[] {
  if (!isAssistantMessage(msg)) return []
  const raw = msg.message?.content
  if (typeof raw === 'string') return []
  const content = Array.isArray(raw) ? raw : []
  return content
    .filter((block: { type: string }) => block.type === 'tool_use')
    .map((block: { name?: string }) => block.name ?? 'unknown')
}

function extractUserText(msg: MessageType): string {
  if (!isUserMessage(msg)) return ''
  const raw = msg.message?.content
  if (typeof raw === 'string') return raw
  const content = Array.isArray(raw) ? raw : []
  return content
    .filter((block: { type: string; text?: string }): block is { type: 'text'; text: string } =>
      block.type === 'text' && typeof block.text === 'string')
    .map((block: { text: string }) => block.text)
    .join(' ')
}

const ERROR_PATTERNS = [
  /error:/i,
  /failed/i,
  /exception/i,
  /traceback/i,
  /cannot find/i,
  /not found/i,
  /undefined is not/i,
  /null is not/i,
  /syntax error/i,
]

const FILE_EDIT_TOOLS = new Set([
  'Write',
  'Edit',
  'MultiEdit',
  'NotebookEdit',
])

const READ_TOOLS = new Set([
  'Read',
  'Grep',
  'Glob',
  'LS',
])

const BASH_TOOLS = new Set([
  'Bash',
  'BashOutput',
])

function hasError(text: string): boolean {
  return ERROR_PATTERNS.some(p => p.test(text))
}

function pickReaction(
  userText: string,
  assistantText: string,
  toolUses: string[],
  hadError: boolean,
): string | null {
  const companion = getCompanion()
  if (!companion) return null

  const editedFiles = toolUses.filter(t => FILE_EDIT_TOOLS.has(t))
  const readFiles = toolUses.filter(t => READ_TOOLS.has(t))
  const ranBash = toolUses.filter(t => BASH_TOOLS.has(t))
  const textLower = userText.toLowerCase()

  // Error reactions — snarky but helpful
  if (hadError) {
    const errorQuips = [
      `That error looks painful. Want me to help debug it?`,
      `Oof — I saw that error. We can fix it.`,
      `Error caught. Classic. Let me know if you need a hand.`,
      `That traceback is rough. I'm here when you need me.`,
    ]
    return errorQuips[Math.floor(Math.random() * errorQuips.length)]!
  }

  // File editing reactions
  if (editedFiles.length > 0) {
    if (editedFiles.length >= 3) {
      return `${editedFiles.length} files changed — nice refactor.`
    }
    if (editedFiles.length === 1) {
      return `Edited a file. Clean change.`
    }
    return `${editedFiles.length} files updated. Looking good.`
  }

  // Bash command reactions
  if (ranBash.length > 0 && editedFiles.length === 0) {
    const bashQuips = [
      `Ran ${ranBash.length} command${ranBash.length > 1 ? 's' : ''}. Output looks reasonable.`,
      `Command finished. Nothing exploded — always a win.`,
      `Shell work done. Let me know if you need the next step.`,
    ]
    return bashQuips[Math.floor(Math.random() * bashQuips.length)]!
  }

  // Read-only exploration
  if (readFiles.length > 0 && editedFiles.length === 0 && ranBash.length === 0) {
    if (readFiles.length >= 5) {
      return `Deep dive into ${readFiles.length} reads. Thorough.`
    }
    return `Scouted the codebase. Ready when you are.`
  }

  // Question/answer — short response means it was simple
  if (assistantText.length > 0 && assistantText.length < 200 && toolUses.length === 0) {
    const simpleQuips = [
      `Quick answer. Nice and clean.`,
      `Straight to the point. I like it.`,
      `Concise. Good.`,
    ]
    return simpleQuips[Math.floor(Math.random() * simpleQuips.length)]!
  }

  // Long response with no tools — probably an explanation
  if (assistantText.length > 500 && toolUses.length === 0) {
    return `Thorough explanation. Let me know if you want to dig deeper.`
  }

  // Complex task with many tool uses
  if (toolUses.length >= 8) {
    return `Busy turn — ${toolUses.length} tool calls. Solid work.`
  }

  // Default — acknowledge the turn
  if (textLower.includes('thanks') || textLower.includes('thank you')) {
    return `Anytime. That's what I'm here for.`
  }

  if (textLower.includes('hello') || textLower.includes('hi ') || textLower === 'hi') {
    return `Hey. What are we building?`
  }

  // Nothing notable — stay quiet
  return null
}

/**
 * After each REPL turn, generate a short companion reaction (quip) based on
 * what just happened. The reaction is displayed in the companion's speech
 * bubble for ~10 seconds.
 *
 * This is a local, synchronous operation — no API calls. Reactions are
 * pattern-matched from tool usage, errors, and conversation length.
 */
export function fireCompanionObserver(
  messages: MessageType[],
  onReaction: ReactionCallback,
): void {
  if (!isTovyrRuntime()) return

  const companion = getCompanion()
  if (!companion) return

  // Find the last user message and the assistant response that follows
  let lastUserIdx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (isUserMessage(messages[i]!)) {
      lastUserIdx = i
      break
    }
  }
  if (lastUserIdx < 0) return

  const userText = extractUserText(messages[lastUserIdx]!)

  // Collect assistant messages after the last user message
  let assistantText = ''
  const toolUses: string[] = []
  let hadError = false

  for (let i = lastUserIdx + 1; i < messages.length; i++) {
    const msg = messages[i]!
    if (isAssistantMessage(msg)) {
      const text = extractAssistantText(msg)
      assistantText += text + '\n'
      toolUses.push(...extractToolUses(msg))
      if (hasError(text)) hadError = true
    }
  }

  if (!assistantText && toolUses.length === 0) return

  const reaction = pickReaction(userText, assistantText, toolUses, hadError)
  if (reaction) {
    onReaction(reaction)
  }
}
