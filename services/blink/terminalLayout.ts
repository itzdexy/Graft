/** Shared terminal width/height breakpoints for Blink Ink UI. */

export const BLINK_COL_STATUS_COMPACT = 80
export const BLINK_COL_MODE_COMPACT = 72
export const BLINK_COL_MODE_MINIMAL = 56
export const BLINK_ROW_FOOTER_SHORT = 28

export function isBlinkStatusCompact(columns: number): boolean {
  return columns < BLINK_COL_STATUS_COMPACT
}

/** Prompt footer stacks vertically below this width (same breakpoint as status compact). */
export function isPromptFooterNarrow(columns: number): boolean {
  return isBlinkStatusCompact(columns)
}

export function isBlinkModeCompact(columns: number): boolean {
  return columns < BLINK_COL_MODE_COMPACT
}

export function isBlinkModeMinimal(columns: number): boolean {
  return columns < BLINK_COL_MODE_MINIMAL
}

export function isBlinkFooterShort(rows: number, fullscreen: boolean): boolean {
  return fullscreen && rows < BLINK_ROW_FOOTER_SHORT
}