import { afterEach, describe, expect, test } from 'bun:test'
import {
  clearProviderModelUnavailable,
  getProviderModelUnavailableReason,
  markProviderModelUnavailable,
  resetProviderModelAvailability,
} from './modelAvailability.js'

describe('provider model availability quarantine', () => {
  afterEach(() => resetProviderModelAvailability())

  test('tracks a failed model without hiding other providers', () => {
    markProviderModelUnavailable('nvidia_nim', 'broken', 'chat endpoint failed')

    expect(
      getProviderModelUnavailableReason('nvidia_nim', 'broken'),
    ).toBe('chat endpoint failed')
    expect(getProviderModelUnavailableReason('openai', 'broken')).toBeNull()
  })

  test('can clear a model after a successful probe', () => {
    markProviderModelUnavailable('nvidia_nim', 'recovered', 'timed out')
    clearProviderModelUnavailable('nvidia_nim', 'recovered')

    expect(
      getProviderModelUnavailableReason('nvidia_nim', 'recovered'),
    ).toBeNull()
  })

  test('expires temporary failures', () => {
    markProviderModelUnavailable('nvidia_nim', 'slow', 'timed out', -1)

    expect(getProviderModelUnavailableReason('nvidia_nim', 'slow')).toBeNull()
  })
})
