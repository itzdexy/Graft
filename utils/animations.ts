/**
 * Animation utilities for subtle state transitions in the terminal UI.
 * Since Ink is a text-based interface, animations are limited to color
 * transitions and visual feedback rather than smooth motion.
 */

export type AnimationState = 'idle' | 'loading' | 'success' | 'error' | 'warning'

/**
 * Get a shimmer color for loading states based on the base color.
 * This creates a subtle pulsing effect for loading indicators.
 */
export function getShimmerColor(baseColor: string): string {
  // For RGB colors, lighten them by adding to each component
  const rgbMatch = baseColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch.map(Number)
    const lighten = (val: number) => Math.min(255, val + 40)
    return `rgb(${lighten(r)}, ${lighten(g)}, ${lighten(b)})`
  }
  
  // For ANSI colors, return a brighter variant
  if (baseColor.startsWith('ansi:')) {
    const colorName = baseColor.replace('ansi:', '')
    if (colorName.includes('Bright')) return baseColor
    return `ansi:${colorName}Bright`
  }
  
  return baseColor
}

/**
 * Get transition color for state changes.
 * Returns appropriate colors for different animation states.
 */
export function getStateTransitionColor(
  state: AnimationState,
  theme: Record<string, string>
): string {
  switch (state) {
    case 'loading':
      return theme.claudeShimmer || theme.subtle
    case 'success':
      return theme.success
    case 'error':
      return theme.error
    case 'warning':
      return theme.warningShimmer || theme.warning
    case 'idle':
    default:
      return theme.subtle
  }
}

/**
 * Create a visual indicator for state transitions.
 * Returns a character or symbol that represents the current state.
 */
export function getStateIndicator(state: AnimationState): string {
  switch (state) {
    case 'loading':
      return '⏳'
    case 'success':
      return '✓'
    case 'error':
      return '✕'
    case 'warning':
      return '⚠'
    case 'idle':
    default:
      return '○'
  }
}

/**
 * Calculate animation frame for pulsing effects.
 * Returns a value between 0 and 1 based on time.
 */
export function getPulseFrame(timestamp: number, period = 1000): number {
  return (Math.sin((timestamp % period) / period * Math.PI * 2) + 1) / 2
}

/**
 * Determine if an element should be highlighted based on animation state.
 */
export function shouldHighlight(state: AnimationState): boolean {
  return state !== 'idle'
}
