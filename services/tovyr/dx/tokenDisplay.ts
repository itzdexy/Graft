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

/**
 * Compact context readout for the status bar: `16.6K (2%)`.
 *
 * Two numbers rather than one, because either alone is ambiguous — a raw count
 * means nothing without the window, and a bare percentage hides how much room
 * is actually left on a 1M-context model.
 */
export function formatContextUsage(input: {
  tokens: number
  contextWindow: number
}): string | null {
  if (input.tokens <= 0) return null

  const count =
    input.tokens >= 1_000_000
      ? `${(input.tokens / 1_000_000).toFixed(1)}M`
      : input.tokens >= 1_000
        ? `${(input.tokens / 1_000).toFixed(1)}K`
        : String(input.tokens)

  if (input.contextWindow <= 0) return count

  // Round up so a barely-started session reads 1%, not 0% — "0%" alongside a
  // non-zero count looks like a broken meter.
  const percent = Math.min(
    100,
    Math.max(1, Math.ceil((input.tokens / input.contextWindow) * 100)),
  )
  return `${count} (${percent}%)`
}
