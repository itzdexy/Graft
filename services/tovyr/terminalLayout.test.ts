import { describe, expect, test } from 'bun:test'
import {
  isTovyrFooterShort,
  isTovyrModeCompact,
  isTovyrModeMinimal,
  isTovyrStatusCompact,
  isPromptFooterNarrow,
  TOVYR_COL_MODE_COMPACT,
  TOVYR_COL_MODE_MINIMAL,
  TOVYR_COL_STATUS_COMPACT,
  TOVYR_ROW_FOOTER_SHORT,
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
    expect(isTovyrStatusCompact(TOVYR_COL_STATUS_COMPACT - 1)).toBe(true)
    expect(isTovyrStatusCompact(TOVYR_COL_STATUS_COMPACT)).toBe(false)
  })

  test('mode compact below 72 columns', () => {
    expect(isTovyrModeCompact(TOVYR_COL_MODE_COMPACT - 1)).toBe(true)
    expect(isTovyrModeCompact(TOVYR_COL_MODE_COMPACT)).toBe(false)
  })

  test('mode minimal below 56 columns', () => {
    expect(isTovyrModeMinimal(TOVYR_COL_MODE_MINIMAL - 1)).toBe(true)
    expect(isTovyrModeMinimal(TOVYR_COL_MODE_MINIMAL)).toBe(false)
  })

  test('footer short only in fullscreen under 28 rows', () => {
    expect(isTovyrFooterShort(TOVYR_ROW_FOOTER_SHORT - 1, true)).toBe(true)
    expect(isTovyrFooterShort(TOVYR_ROW_FOOTER_SHORT, true)).toBe(false)
    expect(isTovyrFooterShort(TOVYR_ROW_FOOTER_SHORT - 1, false)).toBe(false)
  })
})
