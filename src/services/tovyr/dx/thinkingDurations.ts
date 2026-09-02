/**
 * Wall-clock duration for completed thinking blocks.
 *
 * The collapsed reasoning row is meant to read `+ Thought: 16.3s`, but a
 * finished ThinkingBlock carries no timing — the SDK block has `thinking` and
 * `signature`, nothing else. Only the stream layer knows when the block opened,
 * and by the time the transcript renders that context is gone, so every past
 * turn collapsed to a bare `+ Thought` with no duration.
 *
 * The stream records the elapsed time here as the block closes; the row looks
 * it up by content. Keying on the text (rather than object identity) is what
 * makes it survive the hand-off — the block the renderer receives is a
 * different object from the one the stream accumulated.
 */

/** Bounded so a long session cannot grow this without limit. */
const MAX_ENTRIES = 200

const durations = new Map<string, number>()

/**
 * Content hash. Thinking text can be tens of kilobytes and this runs on every
 * render, so key on length plus both ends rather than the whole string.
 */
function keyFor(thinking: string): string | null {
  const trimmed = thinking.trim()
  if (!trimmed) return null
  return `${trimmed.length}:${trimmed.slice(0, 64)}:${trimmed.slice(-64)}`
}

export function recordThinkingDuration(
  thinking: string,
  durationMs: number,
): void {
  const key = keyFor(thinking)
  if (!key || !Number.isFinite(durationMs) || durationMs <= 0) return

  // Re-insert so the most recently seen block is newest in iteration order.
  if (durations.has(key)) durations.delete(key)
  durations.set(key, durationMs)

  while (durations.size > MAX_ENTRIES) {
    const oldest = durations.keys().next()
    if (oldest.done) break
    durations.delete(oldest.value)
  }
}

export function lookupThinkingDuration(thinking: string): number | undefined {
  const key = keyFor(thinking)
  if (!key) return undefined
  return durations.get(key)
}

/** Test seam. */
export function _resetThinkingDurations(): void {
  durations.clear()
}
