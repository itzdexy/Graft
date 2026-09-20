import type { Message, NormalizedMessage } from '../../../types/message.js'
import { isHumanTurn } from '../../../utils/messagePredicates.js'
import type { GraftTranscriptContextValue } from './graftTranscriptCollapse.js'
import { filterGraftAssistantDisplayText } from './chatTextFilter.js'

function assistantHasVisibleContent(
  message: Message | NormalizedMessage,
  ctx: GraftTranscriptContextValue,
): boolean {
  if (message.type !== 'assistant') return false
  if (ctx.hiddenDuplicateAssistantTextUuids.has(message.uuid)) return false

  for (const block of message.message.content) {
    if (block.type === 'tool_use') {
      if (!ctx.hiddenToolUseIds.has(block.id)) return true
      continue
    }
    if (block.type === 'text' && 'text' in block) {
      const display = filterGraftAssistantDisplayText(block.text).trim()
      if (display) return true
    }
  }
  return false
}

/** True when the latest user turn has no visible Graft assistant reply in scrollback. */
export function graftLastTurnNeedsSilentNotice(
  messages: (Message | NormalizedMessage)[],
  ctx: GraftTranscriptContextValue,
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
