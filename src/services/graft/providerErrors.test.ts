import { describe, expect, test } from 'bun:test'
import {
  classifyProviderError,
  isRateLimitErrorText,
  isQuotaErrorText,
  isTimeoutErrorText,
  shouldAttemptProviderFailover,
} from './providerErrors.js'

describe('providerErrors', () => {
  test('classifies generic HTTP 402 gateway errors as billing limits', () => {
    expect(classifyProviderError({ status: 402, message: 'Provider returned error' }).kind).toBe('quota_exceeded')
  })
  test('classifies rate limit 429', () => {
    const err = classifyProviderError({
      status: 429,
      message: 'Rate limit exceeded',
    })
    expect(err.kind).toBe('rate_limit')
    expect(err.retryable).toBe(true)
    expect(err.userMessage).toContain('Rate limit')
  })

  test('classifies quota and billing errors', () => {
    const err = classifyProviderError({
      message: 'You exceeded your current quota, please check your billing',
    })
    expect(err.kind).toBe('quota_exceeded')
    expect(err.retryable).toBe(false)
  })

  test('classifies auth failures', () => {
    const err = classifyProviderError({
      status: 401,
      message: 'Invalid API key',
    })
    expect(err.kind).toBe('auth_failed')
  })

  test('classifies timeouts and cancellation', () => {
    expect(
      classifyProviderError({
        errorName: 'TimeoutError',
        message: 'The operation timed out',
      }).kind,
    ).toBe('timeout')
    expect(
      classifyProviderError({
        status: 499,
        errorName: 'AbortError',
        message: '',
      }).kind,
    ).toBe('cancelled')
  })

  test('classifies model unavailable separately from rate limits', () => {
    const err = classifyProviderError({
      status: 404,
      message: 'Model not found: foo/bar',
    })
    expect(err.kind).toBe('model_unavailable')
    expect(isRateLimitErrorText(err.message)).toBe(false)
  })

  test('classifies network errors', () => {
    const err = classifyProviderError({
      status: 502,
      message: 'fetch failed: ECONNREFUSED',
      errorName: 'TypeError',
    })
    expect(err.kind).toBe('network_error')
    expect(err.retryable).toBe(true)
  })

  test('failover only on model errors', () => {
    expect(shouldAttemptProviderFailover('model_unavailable')).toBe(true)
    expect(shouldAttemptProviderFailover('rate_limit')).toBe(false)
    expect(shouldAttemptProviderFailover('auth_failed')).toBe(false)
    expect(isQuotaErrorText('insufficient credits')).toBe(true)
    expect(isTimeoutErrorText('request timed out')).toBe(true)
  })
})
