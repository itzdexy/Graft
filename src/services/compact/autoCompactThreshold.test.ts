import { describe, expect, test } from 'bun:test'
import {
  AUTOCOMPACT_BUFFER_TOKENS,
  getAutoCompactThreshold,
  getEffectiveContextWindowSize,
} from './autoCompact.js'

/**
 * A non-positive auto-compact threshold means `tokenUsage >= threshold` holds
 * for every token count, so auto-compact fires on every turn forever. The fixed
 * 20k summary reserve plus 13k buffer produced exactly that for any window at
 * or below ~33k — at 32k the threshold was -232.
 *
 * These drive the real functions through TOVYR_CODE_AUTO_COMPACT_WINDOW, which
 * clamps the resolved window, so they exercise the production math rather than
 * a reimplementation of it.
 */
function withWindow<T>(tokens: number, run: () => T): T {
  const previous = process.env.TOVYR_CODE_AUTO_COMPACT_WINDOW
  process.env.TOVYR_CODE_AUTO_COMPACT_WINDOW = String(tokens)
  try {
    return run()
  } finally {
    if (previous === undefined) {
      delete process.env.TOVYR_CODE_AUTO_COMPACT_WINDOW
    } else {
      process.env.TOVYR_CODE_AUTO_COMPACT_WINDOW = previous
    }
  }
}

const MODEL = 'stealth/ox-alpha'
const SMALL_WINDOWS = [2_048, 4_096, 8_192, 16_384, 32_768, 33_000]

describe('auto-compact threshold stays usable on small context windows', () => {
  for (const window of SMALL_WINDOWS) {
    test(`${window} token window yields a positive threshold`, () => {
      const threshold = withWindow(window, () => getAutoCompactThreshold(MODEL))
      expect(threshold).toBeGreaterThan(0)
    })

    test(`${window} token window leaves room to actually work`, () => {
      const { threshold, effective } = withWindow(window, () => ({
        threshold: getAutoCompactThreshold(MODEL),
        effective: getEffectiveContextWindowSize(MODEL),
      }))
      // The threshold must sit below the effective window (there has to be a
      // pre-compact buffer) but above half of it, or compaction triggers so
      // early the session can never accumulate useful context.
      expect(threshold).toBeLessThanOrEqual(effective)
      expect(threshold).toBeGreaterThan(effective / 2)
    })

    test(`${window} token window does not compact an empty conversation`, () => {
      const threshold = withWindow(window, () => getAutoCompactThreshold(MODEL))
      // The regression: a negative threshold made even zero tokens "over".
      expect(0 >= threshold).toBe(false)
    })
  }

  test('effective window is never negative', () => {
    for (const window of [1, 100, 1_000, ...SMALL_WINDOWS]) {
      const effective = withWindow(window, () =>
        getEffectiveContextWindowSize(MODEL),
      )
      expect(effective).toBeGreaterThan(0)
    }
  })

  // TOVYR_CODE_AUTO_COMPACT_WINDOW only clamps the window *down*
  // (`Math.min`), so it cannot be used to simulate a large one. Passing
  // 1_048_576 through withWindow() left the model's own window in force --
  // ~28k under the Tovyr runtime, where getTovyrModelContextWindow() answers
  // for any non-Claude model name -- and the scaled 10% buffer applied instead
  // of the flat 13k. The `[1m]` suffix is the supported way to ask for a 1M
  // window and is honoured before that lookup.
  const LARGE_WINDOW_MODEL = `${MODEL}[1m]`

  test('large windows keep the tuned absolute buffer', () => {
    const threshold = getAutoCompactThreshold(LARGE_WINDOW_MODEL)
    const effective = getEffectiveContextWindowSize(LARGE_WINDOW_MODEL)
    // 10% of a 1M window far exceeds 13k, so the flat buffer still applies --
    // behaviour on normal windows must be unchanged by the scaling fix.
    expect(effective - threshold).toBe(AUTOCOMPACT_BUFFER_TOKENS)
  })

  test('a 1M window does not compact a small conversation', () => {
    const threshold = getAutoCompactThreshold(LARGE_WINDOW_MODEL)
    expect(15_200 >= threshold).toBe(false)
  })
})
