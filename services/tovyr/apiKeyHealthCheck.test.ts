import { describe, expect, test } from 'bun:test'
import {
  buildTovyrApiKeyProbeUrls,
  TOVYR_API_KEY_CHECK_INTERVAL_MS,
  checkTovyrApiKeyHealthIfDue,
  normalizeTovyrProviderBaseUrl,
  resetApiKeyHealthCheckClock,
} from './apiKeyHealthCheck.js'

describe('apiKeyHealthCheck', () => {
  test('interval is five minutes', () => {
    expect(TOVYR_API_KEY_CHECK_INTERVAL_MS).toBe(5 * 60 * 1000)
  })

  test('skips when not due', async () => {
    resetApiKeyHealthCheckClock()
    await checkTovyrApiKeyHealthIfDue({ force: true })
    const second = await checkTovyrApiKeyHealthIfDue()
    expect(second).toBe('skipped')
  })

  test('normalizeTovyrProviderBaseUrl strips trailing slashes', () => {
    expect(normalizeTovyrProviderBaseUrl('https://api.example.com///')).toBe(
      'https://api.example.com',
    )
  })

  test('buildTovyrApiKeyProbeUrls adds /v1/models when base lacks /v1', () => {
    expect(buildTovyrApiKeyProbeUrls('https://integrate.api.nvidia.com')).toEqual(
      [
        'https://integrate.api.nvidia.com/models',
        'https://integrate.api.nvidia.com/v1/models',
      ],
    )
  })

  test('buildTovyrApiKeyProbeUrls avoids duplicate v1 path', () => {
    expect(buildTovyrApiKeyProbeUrls('https://api.openai.com/v1')).toEqual([
      'https://api.openai.com/v1/models',
    ])
  })
})
