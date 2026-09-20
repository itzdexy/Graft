import { env } from '../utils/env.js'

// The former is better vertically aligned, but isn't usually supported on Windows/Linux
export const BLACK_CIRCLE = env.platform === 'darwin' ? '⏺' : '●'
export const BULLET_OPERATOR = '∙'
export const TEARDROP_ASTERISK = '✻'
export const UP_ARROW = '\u2191' // ↑ - used for opus 1m merge notice
export const DOWN_ARROW = '\u2193' // ↓ - used for scroll hint
export const LIGHTNING_BOLT = '↯' // \u21af - used for fast mode indicator
export const EFFORT_LOW = '○' // \u25cb - effort level: low
export const EFFORT_MEDIUM = '◐' // \u25d0 - effort level: medium
export const EFFORT_HIGH = '●' // \u25cf - effort level: high
export const EFFORT_MAX = '◉' // \u25c9 - effort level: max (Opus 4.6 only)

// Media/trigger status indicators
export const PLAY_ICON = '\u25b6' // ▶
export const PAUSE_ICON = '\u23f8' // ⏸

// MCP subscription indicators
export const REFRESH_ARROW = '\u21bb' // ↻ - used for resource update indicator
export const CHANNEL_ARROW = '\u2190' // ← - inbound channel message indicator
export const INJECTED_ARROW = '\u2192' // → - cross-session injected message indicator
export const FORK_GLYPH = '\u2442' // ⑂ - fork directive indicator

// Review status indicators (ultrareview diamond states)
export const DIAMOND_OPEN = '\u25c7' // ◇ - running
export const DIAMOND_FILLED = '\u25c6' // ◆ - completed/failed
export const REFERENCE_MARK = '\u203b' // ※ - komejirushi, away-summary recap marker

// Issue flag indicator
export const FLAG_ICON = '\u2691' // ⚑ - used for issue flag banner

// Blockquote indicator
export const BLOCKQUOTE_BAR = '\u258e' // ▎ - left one-quarter block, used as blockquote line prefix
export const HEAVY_HORIZONTAL = '\u2501' // ━ - heavy box-drawing horizontal

/**
 * Semantic UI glyphs — text-presentation only.
 *
 * Every glyph here is width-1 under `wcwidth`. Emoji (💡, ✅, ❌, 🧠) and any
 * codepoint carrying U+FE0F render width-2 in most terminals but are reported
 * width-1 by some measurement paths, so a row containing one drifts by a column
 * and every box border below it tears. Use these instead of emoji in any string
 * that reaches the TUI, a git commit, or a PR body.
 */
export const HINT_GLYPH = '›' // › - actionable suggestion / next step
export const IDEA_GLYPH = '✲' // ✲ - insight, brainstorm, deep-reasoning mode
export const OK_GLYPH = '✓' // ✓ - success (text presentation, not ✅)
export const FAIL_GLYPH = '✗' // ✗ - failure (text presentation, not ❌)
export const WARN_GLYPH = '⚠' // ⚠ - warning; NEVER append U+FE0F
export const WATCH_GLYPH = '◎' // ◎ - preview / observe
export const BLUEPRINT_GLYPH = '◱' // ◱ - plan / structure
export const AGENT_GLYPH = '◆' // ◆ - authored by the agent (commits, PRs)

// Bridge status indicators
export const BRIDGE_SPINNER_FRAMES = [
  '\u00b7|\u00b7',
  '\u00b7/\u00b7',
  '\u00b7\u2014\u00b7',
  '\u00b7\\\u00b7',
]
export const BRIDGE_READY_INDICATOR = '\u00b7\u2714\ufe0e\u00b7'
export const BRIDGE_FAILED_INDICATOR = '\u00d7'
