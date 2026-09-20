/**
 * Detect a turn that ended without ever answering the user.
 *
 * A stream can stop after a tool result — or after emitting only reasoning —
 * and leave the transcript with no assistant reply at all. The screen simply
 * stops updating: no text, no error, no explanation of why the work ended. The
 * user is left staring at the last tool row wondering whether it is still
 * running. `GraftSilentTurnNotice` exists to say so, and this decides when.
 */

type ContentBlock = {
  type?: unknown
  text?: unknown
}

type MessageLike = {
  type?: unknown
  isMeta?: unknown
  message?: { role?: unknown; content?: unknown }
}

function blocks(message: MessageLike): ContentBlock[] {
  const content = message.message?.content
  if (typeof content === 'string') {
    return content.trim() ? [{ type: 'text', text: content }] : []
  }
  return Array.isArray(content) ? (content as ContentBlock[]) : []
}

/** Visible prose — reasoning and tool calls do not count as a reply. */
function hasVisibleText(message: MessageLike): boolean {
  return blocks(message).some(
    block =>
      block.type === 'text' &&
      typeof block.text === 'string' &&
      block.text.trim().length > 0,
  )
}

function isToolResultOnly(message: MessageLike): boolean {
  const list = blocks(message)
  return list.length > 0 && list.every(block => block.type === 'tool_result')
}

/** A real user prompt, not a tool result or an injected meta message. */
function isHumanPrompt(message: MessageLike): boolean {
  if (message.type !== 'user' || message.isMeta === true) return false
  return !isToolResultOnly(message)
}

export type SilentTurnInput = {
  messages: MessageLike[]
  isLoading: boolean
  /** Tool calls still in flight — the turn has not actually ended yet. */
  inProgressToolCount: number
}

/**
 * True when the most recent turn finished with no assistant prose after the
 * user's last prompt.
 */
export function isSilentTurn({
  messages,
  isLoading,
  inProgressToolCount,
}: SilentTurnInput): boolean {
  if (isLoading || inProgressToolCount > 0) return false

  // Walk back to the user's last prompt; everything after it is this turn.
  let promptIndex = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message && isHumanPrompt(message)) {
      promptIndex = i
      break
    }
  }
  if (promptIndex === -1) return false

  const turn = messages.slice(promptIndex + 1)
  // Nothing happened at all — the request never started, which is a different
  // state (still connecting) and not ours to annotate.
  if (turn.length === 0) return false

  for (const message of turn) {
    if (message.type === 'assistant' && hasVisibleText(message)) return false
    // An error/notice already explains itself; do not stack a second banner.
    if (message.type === 'system') return false
  }
  return true
}
