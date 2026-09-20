/** Shared terminal width/height breakpoints for Graft Ink UI. */

export const GRAFT_COL_STATUS_COMPACT = 80
export const GRAFT_COL_MODE_COMPACT = 72
export const GRAFT_COL_MODE_MINIMAL = 56
export const GRAFT_ROW_FOOTER_SHORT = 28

export function isGraftStatusCompact(columns: number): boolean {
  return columns < GRAFT_COL_STATUS_COMPACT
}

/** Prompt footer stacks vertically below this width (same breakpoint as status compact). */
export function isPromptFooterNarrow(columns: number): boolean {
  return isGraftStatusCompact(columns)
}

export function isGraftModeCompact(columns: number): boolean {
  return columns < GRAFT_COL_MODE_COMPACT
}

export function isGraftModeMinimal(columns: number): boolean {
  return columns < GRAFT_COL_MODE_MINIMAL
}

export function isGraftFooterShort(rows: number, fullscreen: boolean): boolean {
  return fullscreen && rows < GRAFT_ROW_FOOTER_SHORT
}