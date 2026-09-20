import { describe, expect, test } from 'bun:test'
import {
  graftAutoVerifyEnabled,
  MAX_VERIFY_RECOVERY_ROUNDS,
} from './autoVerifyLoop.js'

describe('autoVerifyLoop', () => {
  test('MAX_VERIFY_RECOVERY_ROUNDS is 3', () => {
    expect(MAX_VERIFY_RECOVERY_ROUNDS).toBe(3)
  })

  test('graftAutoVerifyEnabled respects plan mode', () => {
    const prev = process.env.GRAFT_AUTO_VERIFY
    process.env.GRAFT_AUTO_VERIFY = ''
    try {
      expect(graftAutoVerifyEnabled('plan')).toBe(false)
    } finally {
      if (prev === undefined) delete process.env.GRAFT_AUTO_VERIFY
      else process.env.GRAFT_AUTO_VERIFY = prev
    }
  })
})
