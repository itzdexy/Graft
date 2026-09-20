import { describe, expect, test } from 'bun:test'
import {
  AMBIENT_ACTIVE_FRAMES,
  AMBIENT_CYCLE_FRAMES,
  buildAmbientScene,
  buildStaticSky,
  shouldShowAmbientSky,
} from './ambientField.js'

describe('Graft ambient sky', () => {
  test('renders a deterministic, fixed three-row backdrop', () => {
    expect(buildStaticSky(80, 3, 9)).toEqual(buildStaticSky(80, 3, 9))
    expect(buildStaticSky(80, 3, 9)).toHaveLength(3)
    expect(buildStaticSky(80, 3, 9).every(row => row.length === 80)).toBe(
      true,
    )
  })

  test('uses restrained ASCII rather than sparkle glyphs', () => {
    const rows = buildStaticSky(120, 3, 4)
    expect(rows.join('')).toMatch(/^[ .*-]+$/)
    expect(rows.join('')).not.toContain('✦')
    expect(rows.join('').replaceAll(' ', '').length).toBeLessThan(18)
  })

  test('keeps the backdrop still while one short meteor crosses it', () => {
    const quiet = buildAmbientScene({ width: 90, frame: 20, seed: 7 })
    const activeA = buildAmbientScene({ width: 90, frame: 0, seed: 7 })
    const activeB = buildAmbientScene({ width: 90, frame: 1, seed: 7 })

    expect(quiet.active).toBe(false)
    expect(activeA.active).toBe(true)
    expect(activeB.active).toBe(true)
    expect(activeA.rows).not.toEqual(activeB.rows)
    expect(activeA.backdrop).toEqual(activeB.backdrop)
    expect(activeA.rows).toHaveLength(3)
    expect(activeA.rows.every(row => row.length === 90)).toBe(true)
  })

  test('spends most of its cycle quiet', () => {
    const states = Array.from({ length: AMBIENT_CYCLE_FRAMES }, (_, frame) =>
      buildAmbientScene({ width: 90, frame, seed: 11 }),
    )
    expect(states.filter(scene => scene.active)).toHaveLength(
      AMBIENT_ACTIVE_FRAMES,
    )
  })

  test('reduced motion is static and responsive gates avoid cramped layouts', () => {
    const first = buildAmbientScene({
      width: 90,
      frame: 0,
      seed: 3,
      reducedMotion: true,
    })
    const later = buildAmbientScene({
      width: 90,
      frame: 40,
      seed: 3,
      reducedMotion: true,
    })
    expect(first).toEqual(later)
    expect(first.active).toBe(false)
    expect(shouldShowAmbientSky(80, 20, false)).toBe(true)
    expect(shouldShowAmbientSky(63, 20, false)).toBe(false)
    expect(shouldShowAmbientSky(80, 15, false)).toBe(false)
    expect(shouldShowAmbientSky(80, 20, true)).toBe(false)
  })
})
