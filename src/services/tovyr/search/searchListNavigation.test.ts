import { describe, expect, test } from 'bun:test'
import {
  clampCursor,
  nextSelectableIndex,
  visibleWindow,
} from './searchListNavigation.js'

const row = (disabled = false) => ({ disabled })

/** header, a, b, header, c */
const GROUPED = [row(true), row(), row(), row(true), row()]

describe('clampCursor', () => {
  test('empty list parks at 0', () => {
    expect(clampCursor([], 5)).toBe(0)
  })

  test('skips a leading group header', () => {
    expect(clampCursor(GROUPED, 0)).toBe(1)
  })

  test('keeps a valid cursor where it is', () => {
    expect(clampCursor(GROUPED, 2)).toBe(2)
  })

  test('pulls an out-of-range cursor back into the list', () => {
    expect(clampCursor(GROUPED, 99)).toBe(4)
  })

  test('searches backward when nothing selectable follows', () => {
    expect(clampCursor([row(), row(true), row(true)], 2)).toBe(0)
  })

  test('gives 0 when every row is disabled', () => {
    expect(clampCursor([row(true), row(true)], 1)).toBe(0)
  })
})

describe('nextSelectableIndex', () => {
  test('moves down past a header', () => {
    expect(nextSelectableIndex(GROUPED, 2, 1)).toBe(4)
  })

  test('moves up past a header', () => {
    expect(nextSelectableIndex(GROUPED, 4, -1)).toBe(2)
  })

  test('wraps from the last row to the first selectable one', () => {
    expect(nextSelectableIndex(GROUPED, 4, 1)).toBe(1)
  })

  test('wraps from the first selectable row to the last', () => {
    expect(nextSelectableIndex(GROUPED, 1, -1)).toBe(4)
  })

  test('a page jump lands on a selectable row', () => {
    const items = Array.from({ length: 30 }, () => row())
    expect(nextSelectableIndex(items, 0, 12)).toBe(12)
  })

  test('delta of zero just clamps', () => {
    expect(nextSelectableIndex(GROUPED, 0, 0)).toBe(1)
  })

  test('an all-disabled list does not move or hang', () => {
    expect(nextSelectableIndex([row(true), row(true)], 0, 1)).toBe(0)
  })

  test('empty list stays at 0', () => {
    expect(nextSelectableIndex([], 0, 1)).toBe(0)
  })
})

describe('visibleWindow', () => {
  test('shows everything when the list fits', () => {
    expect(visibleWindow(5, 0, 12)).toEqual({ from: 0, to: 5 })
  })

  test('starts at the top for an early cursor', () => {
    expect(visibleWindow(100, 0, 10)).toEqual({ from: 0, to: 10 })
  })

  test('keeps the cursor inside the window', () => {
    const w = visibleWindow(100, 50, 10)
    expect(50).toBeGreaterThanOrEqual(w.from)
    expect(50).toBeLessThan(w.to)
    expect(w.to - w.from).toBe(10)
  })

  test('clamps against the end of the list', () => {
    expect(visibleWindow(100, 99, 10)).toEqual({ from: 90, to: 100 })
  })

  test('never returns a window wider than the list', () => {
    const w = visibleWindow(3, 2, 10)
    expect(w).toEqual({ from: 0, to: 3 })
  })

  test('handles an empty list', () => {
    expect(visibleWindow(0, 0, 10)).toEqual({ from: 0, to: 0 })
  })
})
