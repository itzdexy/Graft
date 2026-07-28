import { describe, expect, test } from 'bun:test'
import { resolveTovyrBuddyName } from './tovyrBuddy.js'

describe('Tovyr buddy identity', () => {
  test('migrates stale product-owned Tovyr names', () => {
    expect(resolveTovyrBuddyName('kairo')).toBe('Tovyr Buddy')
    expect(resolveTovyrBuddyName('Tovyr Code')).toBe('Tovyr Buddy')
  })

  test('keeps a user-customized buddy name', () => {
    expect(resolveTovyrBuddyName('Pixel')).toBe('Pixel')
  })
})
