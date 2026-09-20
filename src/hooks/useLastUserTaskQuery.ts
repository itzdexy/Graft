import { useMemo } from 'react'
import type { Message } from '../types/message.js'
import { getContentText } from '../utils/messages.js'
import { isHumanTurn } from '../utils/messagePredicates.js'

/** Last non-empty user message — used as the task query for project mapping. */
export function getLastUserTaskQuery(messages: Message[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!msg || !isHumanTurn(msg)) continue
    const text = getContentText(msg.message.content)?.trim()
    if (text && !text.startsWith('/')) return text
  }
  return undefined
}

export function useLastUserTaskQuery(messages: Message[]): string | undefined {
  return useMemo(() => getLastUserTaskQuery(messages), [messages])
}
