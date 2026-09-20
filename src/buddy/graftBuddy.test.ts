import { describe, expect, test } from 'bun:test'
import { resolveGraftBuddyName } from './graftBuddy.js'

describe('Graft buddy identity', () => {
  test('migrates stale product-owned Graft names', () => {
    expect(resolveGraftBuddyName('kairo')).toBe('Graft Buddy')
    expect(resolveGraftBuddyName('Graft Code')).toBe('Graft Buddy')
  })

  test('keeps a user-customized buddy name', () => {
    expect(resolveGraftBuddyName('Pixel')).toBe('Pixel')
  })
})
