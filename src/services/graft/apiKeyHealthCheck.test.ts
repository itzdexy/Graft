import { describe, expect, test } from 'bun:test'
import {
  buildGraftApiKeyProbeUrls,
  GRAFT_API_KEY_CHECK_INTERVAL_MS,
  checkGraftApiKeyHealthIfDue,
  normalizeGraftProviderBaseUrl,
  resetApiKeyHealthCheckClock,
} from './apiKeyHealthCheck.js'

describe('apiKeyHealthCheck', () => {
  test('interval is five minutes', () => {
    expect(GRAFT_API_KEY_CHECK_INTERVAL_MS).toBe(5 * 60 * 1000)
  })

  test('skips when not due', async () => {
    resetApiKeyHealthCheckClock()
    await checkGraftApiKeyHealthIfDue({ force: true })
    const second = await checkGraftApiKeyHealthIfDue()
    expect(second).toBe('skipped')
  })

  test('normalizeGraftProviderBaseUrl strips trailing slashes', () => {
    expect(normalizeGraftProviderBaseUrl('https://api.example.com///')).toBe(
      'https://api.example.com',
    )
  })

  test('buildGraftApiKeyProbeUrls adds /v1/models when base lacks /v1', () => {
    expect(buildGraftApiKeyProbeUrls('https://integrate.api.nvidia.com')).toEqual(
      [
        'https://integrate.api.nvidia.com/models',
        'https://integrate.api.nvidia.com/v1/models',
      ],
    )
  })

  test('buildGraftApiKeyProbeUrls avoids duplicate v1 path', () => {
    expect(buildGraftApiKeyProbeUrls('https://api.openai.com/v1')).toEqual([
      'https://api.openai.com/v1/models',
    ])
  })
})
