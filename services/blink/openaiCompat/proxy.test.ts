import { describe, expect, test } from 'bun:test'
import {
  BUN_SERVE_MAX_IDLE_TIMEOUT_SEC,
  getOpenAiCompatProxyUrl,
  openAiCompatProxyConfigsEqual,
  stopOpenAiCompatProxy,
  type OpenAiCompatProxyConfig,
} from './proxy.js'

const sample: OpenAiCompatProxyConfig = {
  providerId: 'nim',
  upstreamBaseUrl: 'https://integrate.api.nvidia.com/v1',
  upstreamApiKey: 'nvapi-test',
}

describe('openAiCompatProxyConfigsEqual', () => {
  test('matches identical config', () => {
    expect(openAiCompatProxyConfigsEqual(sample, { ...sample })).toBe(true)
  })

  test('rejects different provider', () => {
    expect(
      openAiCompatProxyConfigsEqual(sample, {
        ...sample,
        providerId: 'other',
      }),
    ).toBe(false)
  })

  test('rejects null active config', () => {
    expect(openAiCompatProxyConfigsEqual(null, sample)).toBe(false)
  })
})

describe('BUN_SERVE_MAX_IDLE_TIMEOUT_SEC', () => {
  test('stays within Bun.serve limit', () => {
    expect(BUN_SERVE_MAX_IDLE_TIMEOUT_SEC).toBeLessThanOrEqual(255)
    expect(BUN_SERVE_MAX_IDLE_TIMEOUT_SEC).toBeGreaterThan(10)
  })
})

describe('stopOpenAiCompatProxy', () => {
  test('clears proxy url and env', () => {
    process.env.BLINK_OPENAI_COMPAT_PROXY = 'http://127.0.0.1:9999'
    stopOpenAiCompatProxy()
    expect(getOpenAiCompatProxyUrl()).toBeNull()
    expect(process.env.BLINK_OPENAI_COMPAT_PROXY).toBeUndefined()
  })
})