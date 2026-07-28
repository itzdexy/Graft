import type { RefObject } from 'react'
import type { Message } from '../../../types/message.js'
import {
  getTotalInputTokens,
  getTotalOutputTokens,
} from '../../../cost-tracker.js'
import { tokenCountFromLastAPIResponse } from '../../../utils/tokens.js'

/** Billing/session totals from recorded API usage. */
export function getTovyrSessionTokenTotal(): number {
  return getTotalInputTokens() + getTotalOutputTokens()
}

/** Context size from the latest assistant message with usage metadata. */
export function getTovyrContextTokenCount(messages: Message[]): number {
  return tokenCountFromLastAPIResponse(messages)
}

/**
 * Live token display for the status row: prefer API usage, add streaming estimate
 * while the model is still generating text.
 */
export function getTovyrLiveTokenEstimate(
  messages: Message[],
  responseLengthRef?: RefObject<number>,
): number {
  const context = getTovyrContextTokenCount(messages)
  const streamingChars = responseLengthRef?.current ?? 0
  const streamDelta =
    streamingChars > 0 ? Math.max(1, Math.round(streamingChars / 4)) : 0

  if (context > 0 && streamDelta > 0) return context + streamDelta
  if (context > 0) return context

  const sessionTotal = getTovyrSessionTokenTotal()
  if (sessionTotal > 0) return sessionTotal

  return streamDelta
}
