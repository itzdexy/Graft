/**
 * Pull the human-readable text out of a tool_result block.
 *
 * A failed tool used to render as a bare `✗ Glob "*"` row: the status glyph
 * turned red, `shouldExpandTool` returned true for the failure, but the row had
 * no `resultSummary` to expand into because nothing ever passed the tool result
 * down. The reason a command failed — the thing the user actually needs — was
 * computed, stored on the message, and then dropped at the render boundary.
 */

type ToolResultLike = {
  type: string
  tool_use_id?: string
  is_error?: boolean
  content?: unknown
}

type MessageLike = {
  type: string
  message?: { content?: unknown }
}

const MAX_PREVIEW_CHARS = 400

/** Collapse whitespace so a multi-line stderr dump fits one transcript row. */
function condense(value: string, max = MAX_PREVIEW_CHARS): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  return `${flat.slice(0, max - 1)}…`
}

/** tool_result content is either a string or an array of text/image blocks. */
export function flattenToolResultContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (typeof block === 'string') {
      parts.push(block)
      continue
    }
    if (block && typeof block === 'object') {
      const typed = block as { type?: unknown; text?: unknown }
      if (typed.type === 'text' && typeof typed.text === 'string') {
        parts.push(typed.text)
      }
    }
  }
  return parts.join('\n')
}

/**
 * Find the tool_result for `toolUseId` inside the user message that carries it
 * and return a one-line preview, or undefined when there is nothing to show.
 */
export function extractToolResultPreview(
  message: MessageLike | undefined,
  toolUseId: string,
): string | undefined {
  if (!message || message.type !== 'user') return undefined
  const content = message.message?.content
  if (!Array.isArray(content)) return undefined

  for (const raw of content) {
    if (!raw || typeof raw !== 'object') continue
    const block = raw as ToolResultLike
    if (block.type !== 'tool_result') continue
    if (block.tool_use_id !== toolUseId) continue
    const flat = flattenToolResultContent(block.content)
    const preview = condense(flat)
    return preview || undefined
  }
  return undefined
}
