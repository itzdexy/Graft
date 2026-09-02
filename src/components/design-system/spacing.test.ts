import { describe, expect, test } from 'bun:test'
import { BREAKPOINTS, getBreakpoint, LAYOUT, SPACING } from './spacing.js'

describe('spacing', () => {
  test('SPACING constants match the design system', () => {
    expect(SPACING.xs).toBe(1)
    expect(SPACING.sm).toBe(2)
    expect(SPACING.md).toBe(3)
    expect(SPACING.lg).toBe(4)
    expect(SPACING.xl).toBe(6)
  })

  test('LAYOUT provides composer constraints', () => {
    expect(LAYOUT.composerMaxWidth).toBe(72)
    expect(LAYOUT.composerMinWidth).toBe(40)
    expect(LAYOUT.narrowTerminalColumns).toBe(BREAKPOINTS.narrow)
  })

  test('getBreakpoint returns narrow, medium, wide', () => {
    expect(getBreakpoint(40)).toBe('narrow')
    expect(getBreakpoint(BREAKPOINTS.narrow)).toBe('medium')
    expect(getBreakpoint(100)).toBe('medium')
    expect(getBreakpoint(BREAKPOINTS.wide)).toBe('wide')
  })
})
