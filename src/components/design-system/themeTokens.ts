/**
 * Semantic design tokens for the Graft TUI redesign.
 *
 * These map the existing Theme color keys to a cleaner vocabulary and add
 * new surface/border tokens. The tokens are resolved against the current
 * resolved theme name so light, dark, ansi, and daltonized variants all work.
 */
import type { ThemeName } from '../../utils/theme.js'
import { getTheme } from '../../utils/theme.js'

export { SPACING, LAYOUT, BREAKPOINTS, getBreakpoint } from './spacing.js'

export type DesignTokens = {
  background: string
  surface: string
  surfaceFocused: string
  border: string
  borderFocused: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  accent: string
  accentMuted: string
  warning: string
  success: string
  error: string
  selectionBg: string
}

/**
 * Resolve semantic tokens for a given resolved theme name.
 * Falls back to the closest existing theme key to keep limited-color and
 * `NO_COLOR` paths working.
 */
export function getDesignTokens(theme: ThemeName): DesignTokens {
  const t = getTheme(theme)
  return {
    background: 'transparent',
    surface: t.inactive,
    surfaceFocused: t.subtle,
    border: t.inactive,
    borderFocused: t.graftPrimary,
    textPrimary: t.text,
    textSecondary: t.subtle,
    textMuted: t.inactive,
    accent: t.graftPrimary,
    accentMuted: t.graftSecondary,
    warning: t.warning,
    success: t.success,
    error: t.error,
    selectionBg: t.selectionBg,
  }
}
