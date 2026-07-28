import { describe, expect, test } from 'bun:test'
import {
  FRAMES,
  INLINE_FRAMES,
  TOVYR_BUDDY_HEIGHT,
  type TovyrBuddyPose,
} from './TovyrBuddy.js'

describe('TovyrBuddy sprite', () => {
  test('every full frame is 4 rows of width 11', () => {
    const poses = Object.keys(FRAMES) as TovyrBuddyPose[]
    expect(poses.length).toBeGreaterThan(10)
    for (const pose of poses) {
      const lines = FRAMES[pose]
      expect(lines).toHaveLength(TOVYR_BUDDY_HEIGHT)
      for (const line of lines) {
        expect([...line].length).toBe(11)
      }
    }
  })

  test('classic clawd silhouette has four stub legs', () => {
    expect(FRAMES.default[3]).toBe('█ █     █ █')
    expect(FRAMES.default[1]).toBe('██▄█████▄██')
  })

  test('inline frames are width 11', () => {
    for (const line of Object.values(INLINE_FRAMES)) {
      expect([...line].length).toBe(11)
    }
  })

  test('unknown or undefined pose falls back gracefully', () => {
    const unknownPose = 'nonexistent-pose' as any
    const lines = FRAMES[unknownPose] ?? FRAMES.default
    expect(lines).toBeDefined()
    expect(lines).toHaveLength(TOVYR_BUDDY_HEIGHT)
  })
})
