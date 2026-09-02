import { describe, expect, test } from 'bun:test'
import {
  formatElapsedSeconds,
  formatProgressBar,
  formatStartupLoaderFrame,
  pickStartupTip,
} from './tovyrStartupLoader.js'

describe('tovyrStartupLoader', () => {
  test('progress bar helper still fills proportionally', () => {
    expect(formatProgressBar(0, 10)).toBe('░░░░░░░░░░')
    expect(formatProgressBar(0.5, 10)).toBe('█████░░░░░')
    expect(formatProgressBar(1, 10)).toBe('██████████')
  })

  test('elapsed time formats sub-minute and minute values', () => {
    expect(formatElapsedSeconds(450)).toBe('0.5s')
    expect(formatElapsedSeconds(65_000)).toBe('1:05')
  })

  test('startup tips rotate through the tip list', () => {
    const first = pickStartupTip(0)
    const second = pickStartupTip(1)
    expect(first.length).toBeGreaterThan(0)
    expect(second.length).toBeGreaterThan(0)
    expect(first).not.toBe(second)
    // Rotation wraps around.
    expect(pickStartupTip(0)).toBe(first)
  })

  test('startup tips can be disabled via TOVYR_NO_TIPS', () => {
    const prev = process.env.TOVYR_NO_TIPS
    process.env.TOVYR_NO_TIPS = '1'
    try {
      expect(pickStartupTip(0)).toBe('')
      expect(pickStartupTip(100)).toBe('')
    } finally {
      process.env.TOVYR_NO_TIPS = prev
    }
  })

  test('loader frame is centered compact Tovyr stage copy with tip line', () => {
    const frame = formatStartupLoaderFrame({
      phase: 'compile',
      frame: 0,
      elapsedMs: 1200,
      tipIndex: 0,
      columns: 60,
    })
    expect(frame).toContain('Tovyr')
    expect(frame).toContain('Compiling')
    expect(frame).toContain('1.2s')
    expect(frame).toMatch(/v\d+\./)
    expect(frame).toContain('Tip:')
    expect(frame).not.toContain('Compiling modules')
    expect(frame.split('\n')).toHaveLength(5)
  })

  test('loader frame hides tip line when tips are disabled', () => {
    const prev = process.env.TOVYR_NO_TIPS
    process.env.TOVYR_NO_TIPS = '1'
    try {
      const frame = formatStartupLoaderFrame({
        phase: 'compile',
        frame: 0,
        elapsedMs: 1200,
        tipIndex: 0,
        columns: 60,
      })
      expect(frame).not.toContain('Tip:')
      expect(frame.split('\n')).toHaveLength(4)
    } finally {
      process.env.TOVYR_NO_TIPS = prev
    }
  })
})
