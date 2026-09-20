import { describe, expect, test } from 'bun:test'
import { classifyProviderError } from '../providerErrors.js'

describe('provider probe errors', () => {
  test('classifies Bun fetch failures as actionable network errors', () => {
    const error = classifyProviderError({
      errorName: 'TypeError',
      message: 'Unable to connect. Is the computer able to access the url?',
    })

    expect(error.kind).toBe('network_error')
    expect(error.userMessage).toContain('Could not reach the provider')
  })
})