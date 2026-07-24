import { describe, expect, test } from 'bun:test'
import { resolveBlinkBuddyName } from './blinkBuddy.js'

describe('Blink buddy identity', () => {
  test('migrates stale product-owned Kairo names', () => {
    expect(resolveBlinkBuddyName('kairo')).toBe('Blink Buddy')
    expect(resolveBlinkBuddyName('Kairo Code')).toBe('Blink Buddy')
  })

  test('keeps a user-customized buddy name', () => {
    expect(resolveBlinkBuddyName('Pixel')).toBe('Pixel')
  })
})
