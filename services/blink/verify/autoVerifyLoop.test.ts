import { describe, expect, test } from 'bun:test'
import {
  blinkAutoVerifyEnabled,
  MAX_VERIFY_RECOVERY_ROUNDS,
} from './autoVerifyLoop.js'

describe('autoVerifyLoop', () => {
  test('MAX_VERIFY_RECOVERY_ROUNDS is 3', () => {
    expect(MAX_VERIFY_RECOVERY_ROUNDS).toBe(3)
  })

  test('blinkAutoVerifyEnabled respects plan mode', () => {
    const prev = process.env.BLINK_AUTO_VERIFY
    process.env.BLINK_AUTO_VERIFY = ''
    try {
      expect(blinkAutoVerifyEnabled('plan')).toBe(false)
    } finally {
      if (prev === undefined) delete process.env.BLINK_AUTO_VERIFY
      else process.env.BLINK_AUTO_VERIFY = prev
    }
  })
})
