import { afterEach, describe, expect, test } from 'bun:test'
import {
  clearModelReadiness,
  getModelReadiness,
  resetModelReadiness,
  setModelReadiness,
} from './modelReadiness.js'

describe('model readiness evidence', () => {
  afterEach(resetModelReadiness)

  test('keeps a reachable provider separate from a slow model', () => {
    setModelReadiness(
      {
        providerId: 'nvidia_nim',
        modelId: 'meta/llama',
        state: 'slow',
        source: 'probe',
        checkedAt: 100,
        latencyMs: 8_001,
        detail: 'Probe exceeded 8s',
        hardFailure: false,
      },
      100,
    )

    expect(getModelReadiness('nvidia_nim', 'meta/llama', 150)?.state).toBe(
      'slow',
    )
  })

  test('expires transient readiness evidence at its own deadline', () => {
    setModelReadiness(
      {
        providerId: 'p',
        modelId: 'm',
        state: 'slow',
        source: 'probe',
        checkedAt: 0,
        hardFailure: false,
      },
      10,
    )

    expect(getModelReadiness('p', 'm', 10)?.state).toBe('slow')
    expect(getModelReadiness('p', 'm', 11)).toBeNull()
  })

  test('clears one model without changing another provider', () => {
    for (const providerId of ['nvidia_nim', 'openrouter']) {
      setModelReadiness({
        providerId,
        modelId: 'same-id',
        state: 'unavailable',
        source: 'probe',
        checkedAt: 1,
        hardFailure: true,
      })
    }

    clearModelReadiness('nvidia_nim', 'same-id')

    expect(getModelReadiness('nvidia_nim', 'same-id', 2)).toBeNull()
    expect(getModelReadiness('openrouter', 'same-id', 2)?.state).toBe(
      'unavailable',
    )
  })
})
