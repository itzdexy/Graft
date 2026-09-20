/**
 * Terminal spacing system (in character columns/rows).
 *
 * Values match `Theme.spacing` in `utils/theme.ts` — use these constants
 * instead of arbitrary inline numbers so the TUI stays consistent.
 */
export const SPACING = {
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 6,
} as const

export type SpacingKey = keyof typeof SPACING

/** Composer and modal max widths per the design spec. */
export const LAYOUT = {
  composerMaxWidth: 72,
  composerMinWidth: 40,
  modalMaxWidth: 70,
  narrowTerminalColumns: 60,
  shortTerminalRows: 16,
  wideTerminalColumns: 120,
} as const

/** Responsive breakpoints used by layout helpers. */
export const BREAKPOINTS = {
  narrow: 60,
  medium: 80,
  wide: 120,
} as const

export type Breakpoint = 'narrow' | 'medium' | 'wide'

export function getBreakpoint(columns: number): Breakpoint {
  if (columns < BREAKPOINTS.narrow) return 'narrow'
  if (columns < BREAKPOINTS.wide) return 'medium'
  return 'wide'
}
