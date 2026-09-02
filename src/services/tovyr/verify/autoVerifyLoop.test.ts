import { describe, expect, test } from 'bun:test'
import {
  tovyrAutoVerifyEnabled,
  MAX_VERIFY_RECOVERY_ROUNDS,
} from './autoVerifyLoop.js'

describe('autoVerifyLoop', () => {
  test('MAX_VERIFY_RECOVERY_ROUNDS is 3', () => {
    expect(MAX_VERIFY_RECOVERY_ROUNDS).toBe(3)
  })

  test('tovyrAutoVerifyEnabled respects plan mode', () => {
    const prev = process.env.TOVYR_AUTO_VERIFY
    process.env.TOVYR_AUTO_VERIFY = ''
    try {
      expect(tovyrAutoVerifyEnabled('plan')).toBe(false)
    } finally {
      if (prev === undefined) delete process.env.TOVYR_AUTO_VERIFY
      else process.env.TOVYR_AUTO_VERIFY = prev
    }
  })
})
