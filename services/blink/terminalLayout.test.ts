import { describe, expect, test } from 'bun:test'
import {
  isBlinkFooterShort,
  isBlinkModeCompact,
  isBlinkModeMinimal,
  isBlinkStatusCompact,
  isPromptFooterNarrow,
  BLINK_COL_MODE_COMPACT,
  BLINK_COL_MODE_MINIMAL,
  BLINK_COL_STATUS_COMPACT,
  BLINK_ROW_FOOTER_SHORT,
} from './terminalLayout.js'

describe('terminalLayout', () => {
  test('prompt footer narrow matches status compact', () => {
    const expected = new Map([
      [40, true],
      [59, true],
      [60, true],
      [79, true],
      [80, false],
      [120, false],
    ])
    for (const [columns, narrow] of expected) {
      expect(isPromptFooterNarrow(columns)).toBe(narrow)
    }
  })

  test('status compact below 80 columns', () => {
    expect(isBlinkStatusCompact(BLINK_COL_STATUS_COMPACT - 1)).toBe(true)
    expect(isBlinkStatusCompact(BLINK_COL_STATUS_COMPACT)).toBe(false)
  })

  test('mode compact below 72 columns', () => {
    expect(isBlinkModeCompact(BLINK_COL_MODE_COMPACT - 1)).toBe(true)
    expect(isBlinkModeCompact(BLINK_COL_MODE_COMPACT)).toBe(false)
  })

  test('mode minimal below 56 columns', () => {
    expect(isBlinkModeMinimal(BLINK_COL_MODE_MINIMAL - 1)).toBe(true)
    expect(isBlinkModeMinimal(BLINK_COL_MODE_MINIMAL)).toBe(false)
  })

  test('footer short only in fullscreen under 28 rows', () => {
    expect(isBlinkFooterShort(BLINK_ROW_FOOTER_SHORT - 1, true)).toBe(true)
    expect(isBlinkFooterShort(BLINK_ROW_FOOTER_SHORT, true)).toBe(false)
    expect(isBlinkFooterShort(BLINK_ROW_FOOTER_SHORT - 1, false)).toBe(false)
  })
})
