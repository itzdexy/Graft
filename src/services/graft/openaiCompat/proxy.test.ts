import { describe, expect, test } from 'bun:test'
import {
  BUN_SERVE_MAX_IDLE_TIMEOUT_SEC,
  getOpenAiCompatProxyUrl,
  ensureOpenAiCompatProxySync,
  openAiCompatProxyConfigsEqual,
  stopOpenAiCompatProxy,
  type OpenAiCompatProxyConfig,
} from './proxy.js'

const sample: OpenAiCompatProxyConfig = {
  providerId: 'nim',
  upstreamBaseUrl: 'https://integrate.api.nvidia.com/v1',
  upstreamApiKey: 'nvapi-test',
}

test('a blank fallback response is rejected and a later real answer succeeds', async () => {
  let answer = '\n'
  const upstream = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => Response.json({choices: [{message: {role: 'assistant', content: answer}, finish_reason: 'stop'}]}) })
  try {
    const base = ensureOpenAiCompatProxySync({ providerId: 'nvidia_nim', upstreamBaseUrl: `http://127.0.0.1:${upstream.port}/v1`, upstreamApiKey: 'fixture-only' })
    const request = () => fetch(`${base}/v1/messages`, { method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({model: 'nvidia/nemotron-3.5-lightning-30b-a3b', max_tokens: 128, stream: false, messages: [{role: 'user', content: 'Explain the files already read.'}]}) })
    const blank = await request()
    expect(blank.status).toBe(422)
    expect((await blank.json()).error.message).toContain('no answer')
    answer = 'This is a small example application.'
    const success = await request()
    expect(success.status).toBe(200)
    expect((await success.json()).content[0].text).toBe(answer)
  } finally { stopOpenAiCompatProxy(); upstream.stop(true) }
})

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
    process.env.GRAFT_OPENAI_COMPAT_PROXY = 'http://127.0.0.1:9999'
    stopOpenAiCompatProxy()
    expect(getOpenAiCompatProxyUrl()).toBeNull()
    expect(process.env.GRAFT_OPENAI_COMPAT_PROXY).toBeUndefined()
  })
})
