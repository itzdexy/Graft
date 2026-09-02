import { createCombinedAbortSignal } from '../../../utils/combinedAbortSignal.js'

/**
 * How long to wait for a model to say anything at all.
 *
 * Was 30s. Reasoning models routinely spend minutes before the first token,
 * and providers buffer; the old budget declared them dead and — worse —
 * handed the failure to the recovery path, which swapped the model out. Five
 * minutes is patient enough for a cold large model and still short enough
 * that a genuinely hung socket does not hang the session forever. Esc always
 * works, and TOVYR_FIRST_RESPONSE_TIMEOUT_MS=0 disables the deadline.
 */
export const DEFAULT_FIRST_RESPONSE_TIMEOUT_MS = 5 * 60_000
const MAX_FIRST_RESPONSE_TIMEOUT_MS = 60 * 60_000

export class FirstResponseTimeoutError extends Error {
  constructor(
    readonly timeoutMs: number,
    readonly phase: 'response_headers' | 'first_event',
  ) {
    super(formatFirstResponseTimeoutMessage(timeoutMs, phase))
    this.name = 'FirstResponseTimeoutError'
  }
}

export function resolveFirstResponseTimeoutMs(
  raw = process.env.TOVYR_FIRST_RESPONSE_TIMEOUT_MS,
): number {
  if (raw?.trim() === '0') return 0
  const parsed = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(parsed) || parsed < 1_000) {
    return DEFAULT_FIRST_RESPONSE_TIMEOUT_MS
  }
  return Math.min(parsed, MAX_FIRST_RESPONSE_TIMEOUT_MS)
}

export function formatFirstResponseTimeoutMessage(
  timeoutMs: number,
  phase: 'response_headers' | 'first_event' = 'response_headers',
): string {
  const seconds = Math.max(1, Math.round(timeoutMs / 1_000))
  const boundary =
    phase === 'response_headers'
      ? 'before response headers arrived'
      : 'before the first stream event arrived'
  return (
    `Model request timed out after ${seconds}s ${boundary}. ` +
    'Try /model for another verified model, or /provider to switch providers.'
  )
}

export type FirstResponseGuard = {
  signal: AbortSignal
  didTimeout: () => boolean
  complete: () => void
  cleanup: () => void
}

/**
 * A request-local deadline. It never aborts the caller's controller, so Esc
 * remains distinguishable from a slow provider and query-level recovery can
 * safely try another model before any response event has been received.
 */
export function createFirstResponseGuard(
  parentSignal: AbortSignal,
  timeoutMs = resolveFirstResponseTimeoutMs(),
): FirstResponseGuard {
  let settled = false
  const combined = createCombinedAbortSignal(parentSignal, {
    timeoutMs: timeoutMs > 0 ? timeoutMs : undefined,
  })
  const cleanup = () => {
    if (settled) return
    settled = true
    combined.cleanup()
  }
  return {
    signal: combined.signal,
    didTimeout: () =>
      timeoutMs > 0 &&
      !settled &&
      combined.signal.aborted &&
      !parentSignal.aborted,
    complete: cleanup,
    cleanup,
  }
}
