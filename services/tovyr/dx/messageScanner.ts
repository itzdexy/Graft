/** Minimal message shape for scanning tool_use blocks without tight coupling. */
type ScannableMessage = {
  type: string
  message?: {
    content?: unknown
  }
  timestamp?: string
}

type ToolUseBlock = {
  type: 'tool_use'
  name: string
  input?: Record<string, unknown>
}

function isToolUseBlock(block: unknown): block is ToolUseBlock {
  return (
    typeof block === 'object' &&
    block !== null &&
    (block as ToolUseBlock).type === 'tool_use' &&
    typeof (block as ToolUseBlock).name === 'string'
  )
}

export type ScannedToolUse = {
  name: string
  summary: string
  at?: number
}

function summarizeFromInput(name: string, input?: Record<string, unknown>): string {
  if (!input) return ''
  if (name === 'Bash' && typeof input.command === 'string') {
    const cmd = input.command.trim()
    return cmd.length > 50 ? `${cmd.slice(0, 47)}...` : cmd
  }
  if (typeof input.file_path === 'string') return input.file_path
  if (typeof input.pattern === 'string') return input.pattern
  if (typeof input.description === 'string') {
    return input.description.slice(0, 50)
  }
  return ''
}

/** Last N tool uses from assistant messages (newest last). */
export function extractRecentToolUses(
  messages: ScannableMessage[],
  limit = 8,
): ScannedToolUse[] {
  const found: ScannedToolUse[] = []
  for (const msg of messages) {
    if (msg.type !== 'assistant') continue
    const content = msg.message?.content
    if (!Array.isArray(content)) continue
    for (const block of content) {
      if (!isToolUseBlock(block)) continue
      const at = msg.timestamp ? Date.parse(msg.timestamp) : undefined
      found.push({
        name: block.name,
        summary: summarizeFromInput(block.name, block.input),
        at: Number.isFinite(at) ? at : undefined,
      })
    }
  }
  return found.slice(-limit)
}

export function getLastToolLabel(messages: ScannableMessage[]): string | null {
  const recent = extractRecentToolUses(messages, 1)
  const last = recent[recent.length - 1]
  if (!last) return null
  return last.summary ? `${last.name}: ${last.summary}` : last.name
}
