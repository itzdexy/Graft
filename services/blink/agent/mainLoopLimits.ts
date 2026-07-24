import { isBlinkRuntime } from '../../../utils/blinkRuntime.js'

/** Default max agentic turns for the main REPL loop (tool-use recursion). */
export const BLINK_DEFAULT_MAIN_MAX_TURNS = 200

/**
 * Resolve max turns for the main query loop.
 * Set `BLINK_MAX_TURNS=0` to disable the limit.
 * Inspired by OpenCode / Codex bounded agent loops.
 */
export function resolveMainLoopMaxTurns(
  explicit?: number,
): number | undefined {
  if (typeof explicit === 'number' && explicit > 0) {
    return explicit
  }

  if (!isBlinkRuntime()) return explicit

  const raw = process.env.BLINK_MAX_TURNS?.trim()
  if (raw === '0' || raw?.toLowerCase() === 'off') {
    return undefined
  }
  if (raw) {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return BLINK_DEFAULT_MAIN_MAX_TURNS
}

export function formatMaxTurnsReachedMessage(
  maxTurns: number,
  turnCount: number,
): string {
  return [
    `Blink reached the turn limit (${turnCount}/${maxTurns}).`,
    'Summarize progress and ask the user to continue, or raise BLINK_MAX_TURNS.',
    'Use `/agent` for long autonomous tasks with persisted steps.',
  ].join(' ')
}
