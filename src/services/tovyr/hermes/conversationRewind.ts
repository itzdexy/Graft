import {
  messagesAfterAreOnlySynthetic,
  selectableUserMessagesFilter,
} from '../../../components/MessageSelector.js'
import type { Message, UserMessage } from '../../../types/message.js'

export function findLastSelectableUserMessage(
  messages: Message[],
): UserMessage | undefined {
  return messages.findLast(selectableUserMessagesFilter)
}

export function findPreviousSelectableUserMessage(
  messages: Message[],
): UserMessage | undefined {
  const selectable = messages.filter(selectableUserMessagesFilter)
  if (selectable.length < 2) return undefined
  return selectable[selectable.length - 2]
}

/** True when rewinding to `message` only drops synthetic / empty follow-ups. */
export function canRewindToUserMessage(
  messages: Message[],
  message: UserMessage,
): boolean {
  const idx = messages.lastIndexOf(message)
  if (idx === -1) return false
  return messagesAfterAreOnlySynthetic(messages, idx)
}
