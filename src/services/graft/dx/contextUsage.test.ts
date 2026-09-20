import { describe, expect, test } from 'bun:test'
import { formatContextUsage } from './tokenDisplay.js'

describe('formatContextUsage', () => {
  test('renders thousands with one decimal and a percentage', () => {
    expect(formatContextUsage({ tokens: 16_600, contextWindow: 1_000_000 })).toBe(
      '16.6K (2%)',
    )
  })

  test('renders millions once past 1M', () => {
    expect(
      formatContextUsage({ tokens: 1_200_000, contextWindow: 2_000_000 }),
    ).toBe('1.2M (60%)')
  })

  test('small counts stay exact', () => {
    expect(formatContextUsage({ tokens: 420, contextWindow: 200_000 })).toBe(
      '420 (1%)',
    )
  })

  test('a barely-started session reads 1%, never 0%', () => {
    // "0%" next to a non-zero count looks like a broken meter.
    expect(formatContextUsage({ tokens: 10, contextWindow: 1_000_000 })).toBe(
      '10 (1%)',
    )
  })

  test('a full window caps at 100%', () => {
    expect(
      formatContextUsage({ tokens: 300_000, contextWindow: 200_000 }),
    ).toBe('300.0K (100%)')
  })

  test('an unknown window falls back to the raw count', () => {
    expect(formatContextUsage({ tokens: 16_600, contextWindow: 0 })).toBe('16.6K')
  })

  test('nothing to show yet renders nothing', () => {
    expect(formatContextUsage({ tokens: 0, contextWindow: 200_000 })).toBeNull()
  })
})
