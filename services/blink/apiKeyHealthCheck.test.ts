import { describe, expect, test } from 'bun:test'
import {
  buildBlinkApiKeyProbeUrls,
  BLINK_API_KEY_CHECK_INTERVAL_MS,
  checkBlinkApiKeyHealthIfDue,
  normalizeBlinkProviderBaseUrl,
  resetApiKeyHealthCheckClock,
} from './apiKeyHealthCheck.js'

describe('apiKeyHealthCheck', () => {
  test('interval is five minutes', () => {
    expect(BLINK_API_KEY_CHECK_INTERVAL_MS).toBe(5 * 60 * 1000)
  })

  test('skips when not due', async () => {
    resetApiKeyHealthCheckClock()
    await checkBlinkApiKeyHealthIfDue({ force: true })
    const second = await checkBlinkApiKeyHealthIfDue()
    expect(second).toBe('skipped')
  })

  test('normalizeBlinkProviderBaseUrl strips trailing slashes', () => {
    expect(normalizeBlinkProviderBaseUrl('https://api.example.com///')).toBe(
      'https://api.example.com',
    )
  })

  test('buildBlinkApiKeyProbeUrls adds /v1/models when base lacks /v1', () => {
    expect(buildBlinkApiKeyProbeUrls('https://integrate.api.nvidia.com')).toEqual(
      [
        'https://integrate.api.nvidia.com/models',
        'https://integrate.api.nvidia.com/v1/models',
      ],
    )
  })

  test('buildBlinkApiKeyProbeUrls avoids duplicate v1 path', () => {
    expect(buildBlinkApiKeyProbeUrls('https://api.openai.com/v1')).toEqual([
      'https://api.openai.com/v1/models',
    ])
  })
})
