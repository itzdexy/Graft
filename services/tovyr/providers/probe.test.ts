import { describe, expect, test } from 'bun:test'
import { readProviderQuota, stateForProbeResult } from './probe.js'

describe('provider connection probe helpers', () => {
  test('reads provider-neutral request quota headers', () => {
    const quota = readProviderQuota(
      new Headers({
        'x-ratelimit-remaining-requests': '0',
        'x-ratelimit-limit-requests': '100',
        'x-ratelimit-reset-requests': '2000000000',
      }),
    )

    expect(quota).toEqual({
      limited: true,
      remaining: 0,
      limit: 100,
      resetsAt: 2_000_000_000,
    })
  })

  test('returns undefined without quota evidence', () => {
    expect(readProviderQuota(new Headers())).toBeUndefined()
  })

  test('treats a real non-streamed probe answer as ready', () => {
    expect(stateForProbeResult({ text: 'OK' })).toBe('ready')
  })

  test('reports degraded only when the provider returns no model output', () => {
    expect(stateForProbeResult({ text: '   ' })).toBe('degraded')
  })

  test('quota state takes priority over model output', () => {
    expect(
      stateForProbeResult({
        text: 'OK',
        quota: { limited: true },
      }),
    ).toBe('limited')
  })
})
