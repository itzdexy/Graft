import type { Message as MessageType } from '../../../types/message.js'
import { mergeMemoryUpdatesFromText } from './memory.js'

function extractAssistantText(message: MessageType): string {
  if (message.type !== 'assistant') return ''
  return message.message.content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map(block => block.text)
    .join('\n')
}

/** After each REPL turn, persist Buddy "## Memory updates" bullets when present. */
export function syncBuddyMemoryFromTurn(
  messages: MessageType[],
  cwd: string,
): { updated: boolean; count: number } {
  for (let i = messages.length - 1; i >= 0; i--) {
    const text = extractAssistantText(messages[i]!)
    if (!text) continue
    return mergeMemoryUpdatesFromText(cwd, text)
  }
  return { updated: false, count: 0 }
}
