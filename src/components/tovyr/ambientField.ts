import { LAYOUT } from '../design-system/spacing.js'

const AMBIENT_GLYPHS = ['·', '·', '·', '✦'] as const

/** Deterministic, sparse terminal sky that remains legible in any theme. */
export function buildAmbientLine(
  width: number,
  frame = 0,
  seed = 17,
): string {
  const safeWidth = Math.max(0, Math.min(240, width))
  const cells = Array.from({ length: safeWidth }, () => ' ')
  for (let index = 0; index < safeWidth; index++) {
    const hash = (index * 37 + seed * 19 + frame * 11) % 101
    if (hash < 4) {
      cells[index] =
        AMBIENT_GLYPHS[(index + seed + frame) % AMBIENT_GLYPHS.length]!
    }
  }
  return cells.join('')
}

/** Frames in one full ambient cycle. */
export const AMBIENT_CYCLE_FRAMES = 48
/** Frames of that cycle a meteor is visible — the rest is still. */
export const AMBIENT_ACTIVE_FRAMES = 6

/** Restrained ASCII: a starfield should not compete with the transcript. */
const SKY_GLYPHS = ['.', '.', '*', '-'] as const
const SKY_ROWS = 3
/** Roughly 3% fill. Dense starfields read as noise at terminal resolution. */
const SKY_DENSITY_MODULUS = 211
const SKY_DENSITY_CUTOFF = 6

const METEOR_TRAIL = ['*', '-', '.'] as const

function clampWidth(width: number): number {
  return Math.max(0, Math.min(240, Math.floor(width)))
}

/**
 * Fixed backdrop for the ambient sky. Depends only on its arguments, so the
 * same terminal size always yields the same stars — a starfield that reshuffles
 * every frame reads as static, not as depth.
 */
export function buildStaticSky(
  width: number,
  rows: number = SKY_ROWS,
  seed = 17,
): string[] {
  const safeWidth = clampWidth(width)
  const safeRows = Math.max(0, Math.floor(rows))
  return Array.from({ length: safeRows }, (_, row) => {
    const cells = Array.from({ length: safeWidth }, (_, col) => {
      const hash =
        (col * 37 + row * 101 + seed * 19) % SKY_DENSITY_MODULUS
      if (hash >= SKY_DENSITY_CUTOFF) return ' '
      return SKY_GLYPHS[(col + row + seed) % SKY_GLYPHS.length]!
    })
    return cells.join('')
  })
}

export type AmbientScene = {
  /** The still starfield, identical on every frame of a given size. */
  backdrop: string[]
  /** The backdrop with any meteor composited in. */
  rows: string[]
  /** True only while a meteor is crossing. */
  active: boolean
}

function overlayMeteor(
  backdrop: string[],
  width: number,
  phase: number,
  seed: number,
): string[] {
  const row = seed % Math.max(1, backdrop.length)
  const line = backdrop[row]
  if (line === undefined) return backdrop
  // Travel far enough to clear the trail off the right edge by the last frame.
  const span = width + METEOR_TRAIL.length
  const head = Math.floor((phase / AMBIENT_ACTIVE_FRAMES) * span)
  const cells = [...line]
  for (let offset = 0; offset < METEOR_TRAIL.length; offset++) {
    const col = head - offset
    if (col < 0 || col >= width) continue
    cells[col] = METEOR_TRAIL[offset]!
  }
  const next = [...backdrop]
  next[row] = cells.join('')
  return next
}

/**
 * One frame of the ambient sky: a still starfield that a short meteor crosses
 * for a few frames out of every cycle.
 *
 * The backdrop deliberately does not animate. Continuous twinkling costs a full
 * repaint every frame and pulls the eye away from the conversation; a rare,
 * brief meteor gives the screen life for a fraction of the cost.
 */
export function buildAmbientScene(input: {
  width: number
  frame: number
  seed?: number
  reducedMotion?: boolean
}): AmbientScene {
  const width = clampWidth(input.width)
  const seed = input.seed ?? 17
  const backdrop = buildStaticSky(width, SKY_ROWS, seed)

  if (input.reducedMotion) {
    return { backdrop, rows: backdrop, active: false }
  }

  const phase =
    ((Math.floor(input.frame) % AMBIENT_CYCLE_FRAMES) + AMBIENT_CYCLE_FRAMES) %
    AMBIENT_CYCLE_FRAMES
  const active = phase < AMBIENT_ACTIVE_FRAMES
  if (!active) return { backdrop, rows: backdrop, active: false }

  return {
    backdrop,
    rows: overlayMeteor(backdrop, width, phase, seed),
    active: true,
  }
}

/**
 * Whether there is room for the sky at all. Below these sizes the backdrop
 * crowds the content it is meant to frame, and reduced motion opts out entirely.
 */
export function shouldShowAmbientSky(
  columns: number,
  rows: number,
  reducedMotion: boolean,
): boolean {
  if (reducedMotion) return false
  return columns >= LAYOUT.composerMaxWidth && rows >= LAYOUT.shortTerminalRows
}
