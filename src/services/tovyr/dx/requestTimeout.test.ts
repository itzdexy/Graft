import { describe, expect, test } from 'bun:test'
import {
  createFirstResponseGuard,
  formatFirstResponseTimeoutMessage,
  resolveFirstResponseTimeoutMs,
} from './requestTimeout.js'

describe('first response timeout', () => {
  test('defaults to five minutes and accepts a bounded override', () => {
    // Reasoning models routinely spend minutes before the first token; the
    // old 30s budget declared them dead and triggered a model swap.
    expect(resolveFirstResponseTimeoutMs(undefined)).toBe(5 * 60_000)
    expect(resolveFirstResponseTimeoutMs('12000')).toBe(12_000)
    expect(resolveFirstResponseTimeoutMs('nope')).toBe(5 * 60_000)
    expect(resolveFirstResponseTimeoutMs('0')).toBe(0)
  })

  test('an override is capped at an hour', () => {
    expect(resolveFirstResponseTimeoutMs('99999999')).toBe(60 * 60_000)
  })

  test('explains that the model failed before response headers', () => {
    const message = formatFirstResponseTimeoutMessage(30_000)
    expect(message).toContain('timed out after 30s')
    expect(message).toContain('before response headers')
    expect(message).toContain('/model')
  })

  test('distinguishes a guard timeout from a user abort', async () => {
    const parent = new AbortController()
    const timeout = createFirstResponseGuard(parent.signal, 5)
    await new Promise(resolve => setTimeout(resolve, 15))
    expect(timeout.signal.aborted).toBe(true)
    expect(timeout.didTimeout()).toBe(true)
    timeout.cleanup()

    const user = new AbortController()
    const userGuard = createFirstResponseGuard(user.signal, 1_000)
    user.abort()
    expect(userGuard.signal.aborted).toBe(true)
    expect(userGuard.didTimeout()).toBe(false)
    userGuard.cleanup()
  })
})
