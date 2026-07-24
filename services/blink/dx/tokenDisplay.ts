import type { RefObject } from 'react'
import type { Message } from '../../../types/message.js'
import {
  getTotalInputTokens,
  getTotalOutputTokens,
} from '../../../cost-tracker.js'
import { tokenCountFromLastAPIResponse } from '../../../utils/tokens.js'

/** Billing/session totals from recorded API usage. */
export function getBlinkSessionTokenTotal(): number {
  return getTotalInputTokens() + getTotalOutputTokens()
}

/** Context size from the latest assistant message with usage metadata. */
export function getBlinkContextTokenCount(messages: Message[]): number {
  return tokenCountFromLastAPIResponse(messages)
}

/**
 * Live token display for the status row: prefer API usage, add streaming estimate
 * while the model is still generating text.
 */
export function getBlinkLiveTokenEstimate(
  messages: Message[],
  responseLengthRef?: RefObject<number>,
): number {
  const context = getBlinkContextTokenCount(messages)
  const streamingChars = responseLengthRef?.current ?? 0
  const streamDelta =
    streamingChars > 0 ? Math.max(1, Math.round(streamingChars / 4)) : 0

  if (context > 0 && streamDelta > 0) return context + streamDelta
  if (context > 0) return context

  const sessionTotal = getBlinkSessionTokenTotal()
  if (sessionTotal > 0) return sessionTotal

  return streamDelta
}
