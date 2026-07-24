import { describe, expect, test } from 'bun:test'
import {
  FRAMES,
  INLINE_FRAMES,
  BLINK_BUDDY_HEIGHT,
  type BlinkBuddyPose,
} from './BlinkBuddy.js'

describe('BlinkBuddy sprite', () => {
  test('every full frame is 4 rows of width 11', () => {
    const poses = Object.keys(FRAMES) as BlinkBuddyPose[]
    expect(poses.length).toBeGreaterThan(10)
    for (const pose of poses) {
      const lines = FRAMES[pose]
      expect(lines).toHaveLength(BLINK_BUDDY_HEIGHT)
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
})
