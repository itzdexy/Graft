/** Shared terminal width/height breakpoints for Tovyr Ink UI. */

export const TOVYR_COL_STATUS_COMPACT = 80
export const TOVYR_COL_MODE_COMPACT = 72
export const TOVYR_COL_MODE_MINIMAL = 56
export const TOVYR_ROW_FOOTER_SHORT = 28

export function isTovyrStatusCompact(columns: number): boolean {
  return columns < TOVYR_COL_STATUS_COMPACT
}

/** Prompt footer stacks vertically below this width (same breakpoint as status compact). */
export function isPromptFooterNarrow(columns: number): boolean {
  return isTovyrStatusCompact(columns)
}

export function isTovyrModeCompact(columns: number): boolean {
  return columns < TOVYR_COL_MODE_COMPACT
}

export function isTovyrModeMinimal(columns: number): boolean {
  return columns < TOVYR_COL_MODE_MINIMAL
}

export function isTovyrFooterShort(rows: number, fullscreen: boolean): boolean {
  return fullscreen && rows < TOVYR_ROW_FOOTER_SHORT
}