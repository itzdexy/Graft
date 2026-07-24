import type { Message, NormalizedMessage } from '../../../types/message.js'
import { isHumanTurn } from '../../../utils/messagePredicates.js'
import type { BlinkTranscriptContextValue } from './blinkTranscriptCollapse.js'
import { filterBlinkAssistantDisplayText } from './chatTextFilter.js'

function assistantHasVisibleContent(
  message: Message | NormalizedMessage,
  ctx: BlinkTranscriptContextValue,
): boolean {
  if (message.type !== 'assistant') return false
  if (ctx.hiddenDuplicateAssistantTextUuids.has(message.uuid)) return false

  for (const block of message.message.content) {
    if (block.type === 'tool_use') {
      if (!ctx.hiddenToolUseIds.has(block.id)) return true
      continue
    }
    if (block.type === 'text' && 'text' in block) {
      const display = filterBlinkAssistantDisplayText(block.text).trim()
      if (display) return true
    }
  }
  return false
}

/** True when the latest user turn has no visible Blink assistant reply in scrollback. */
export function blinkLastTurnNeedsSilentNotice(
  messages: (Message | NormalizedMessage)[],
  ctx: BlinkTranscriptContextValue,
  isLoading: boolean,
): boolean {
  if (isLoading || messages.length === 0) return false

  let sawUser = false
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!msg) continue
    if (msg.type === 'system' && msg.subtype === 'turn_duration') continue
    if (isHumanTurn(msg)) {
      sawUser = true
      break
    }
    if (assistantHasVisibleContent(msg, ctx)) return false
  }
  return sawUser
}
