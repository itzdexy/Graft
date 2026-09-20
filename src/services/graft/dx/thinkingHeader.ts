/**
 * Header line for a reasoning block.
 *
 * Modelled on opencode's transcript: a finished thought collapses to a single
 * dim line carrying only its cost in time — `+ Thought: 16.3s` — which expands
 * in place to `- Thought: 16.3s` above the prose. The previous treatment framed
 * every block with `┌─ Analysis` / `└─ Complete` rules, which spent four lines
 * of chrome on content most readers skip.
 */

/** Marker in the gutter. `+` invites expansion, `-` offers collapse. */
export type ThinkingHeaderState = 'streaming' | 'collapsed' | 'expanded'

/**
 * Seconds with one decimal below a minute, then `m ss`. Sub-second thoughts
 * still show a number rather than "0s", because "0.4s" reads as measured and
 * "0s" reads as broken.
 */
export function formatThinkingDuration(elapsedMs: number): string {
  const ms = Math.max(0, elapsedMs)
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes}m ${String(rest).padStart(2, '0')}s`
}

export type ThinkingHeader = {
  /** Leading glyph: '+', '-' or the streaming mark. */
  marker: string
  /** Text after the marker. */
  label: string
}

/** Longest gist that still fits a narrow terminal without wrapping oddly. */
const GIST_CHARS = 120

/**
 * First substantive line of the reasoning, for the collapsed row.
 *
 * `+ Thought: 16.3s` alone announces that reasoning happened and withholds all
 * of it, and the ctrl+o hint is suppressed inside the virtual list — so the
 * row was unreadable and looked unexpandable. Markdown headers and list
 * bullets are stripped so the gist reads as prose.
 */
export function summarizeThinkingGist(thinking: string): string {
  for (const line of thinking.split('\n')) {
    const cleaned = line
      .replace(/^\s*#{1,6}\s*/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+\.\s+/, '')
      .replace(/[*_`]/g, '')
      .trim()
    if (cleaned.length < 2) continue
    return cleaned.length > GIST_CHARS
      ? `${cleaned.slice(0, GIST_CHARS - 1)}…`
      : cleaned
  }
  return ''
}

export function formatThinkingHeader(input: {
  state: ThinkingHeaderState
  elapsedMs?: number
}): ThinkingHeader {
  if (input.state === 'streaming') {
    // Was `∴` (U+2234 THEREFORE). At terminal size its three dots read as an
    // inverted cross rather than as an icon, and it was the only
    // punctuation-derived glyph in an otherwise geometric set. `◐` is the
    // first frame of the thinking animation, so the still and moving states
    // now show the same shape.
    return { marker: '◐', label: 'Thinking' }
  }
  const marker = input.state === 'expanded' ? '-' : '+'
  // A finished block with no measured duration still gets a header; omitting
  // the number is better than inventing 0.0s.
  const label =
    input.elapsedMs === undefined
      ? 'Thought'
      : `Thought: ${formatThinkingDuration(input.elapsedMs)}`
  return { marker, label }
}

/** Follow the latest model reasoning while it streams, without growing the row. */
export function summarizeLiveThinking(thinking: string): string {
  const tail = thinking.trimEnd().split('\n').filter(line => line.trim()).at(-1) ?? ''
  const text = tail.replace(/[*_`]/g, '').replace(/^\s*#{1,6}\s*/, '').trim()
  if (text.length <= GIST_CHARS) return text
  const suffix = text.slice(-(GIST_CHARS - 2))
  const boundary = suffix.indexOf(' ')
  return `… ${boundary >= 0 && boundary < 30 ? suffix.slice(boundary + 1) : suffix}`
}
