import { expect, test } from 'bun:test'
import { fetchOpenAiProbe, classifyProbeOutcome, probeFailureDetail } from './probe.js'

test('model checks explain generic gateway failures using their HTTP classification', () => {
  const rate = probeFailureDetail('rate_limit', 'OpenRouter', 'https://openrouter.ai/api/v1', 'Provider returned error', 429, '30')
  expect(rate).toContain('rate limit (HTTP 429)')
  expect(rate).toContain('Wait 30 seconds')
  expect(rate).toContain('previous model is unchanged')
  expect(rate).not.toContain('Provider returned error')
  expect(probeFailureDetail('auth_failed', 'OpenRouter', '', 'API key expired.', 401)).toContain('API key expired (HTTP 401)')
  expect(probeFailureDetail('quota_exceeded', 'Provider', '', 'Provider returned error', 402)).toContain('quota or credit limit')
  expect(probeFailureDetail('unknown', 'Provider', '', 'Provider returned error', 400)).toContain('could not complete the model check (HTTP 400)')
})

test('every provider probe stays on its selected endpoint despite stale session environment', async () => {
  const originalFetch = globalThis.fetch
  const previous = process.env.GRAFT_OPENAI_UPSTREAM_URL
  process.env.GRAFT_OPENAI_UPSTREAM_URL = 'https://previous-provider.invalid/v1'
  const requests: Array<{ url: string; auth: string | null }> = []
  globalThis.fetch = (async (input, init) => {
    requests.push({ url: String(input), auth: new Headers(init?.headers).get('Authorization') })
    return new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), { headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  try {
    for (const providerId of ['nvidia_nim', 'openai', 'openrouter', 'cerebras', 'groq']) {
      const baseUrl = `https://${providerId}.example/v1`
      await fetchOpenAiProbe({ providerId, baseUrl, apiKey: 'fixture-only', authMode: 'authToken', model: 'fixture-model' } as Parameters<typeof fetchOpenAiProbe>[0], new AbortController().signal)
      expect(requests.at(-1)?.url).toBe(`${baseUrl}/chat/completions`)
      expect(requests.at(-1)?.auth).toBe('Bearer fixture-only')
    }
    expect(requests.some(r => r.url.includes('previous-provider'))).toBe(false)
  } finally {
    globalThis.fetch = originalFetch
    if (previous === undefined) delete process.env.GRAFT_OPENAI_UPSTREAM_URL
    else process.env.GRAFT_OPENAI_UPSTREAM_URL = previous
  }
})

test('transient inference failures do not erase reachable model inventory', () => {
  expect(classifyProbeOutcome({ providerReachable: true, transientFailure: true }).modelState).toBe('slow')
  expect(classifyProbeOutcome({ providerReachable: false, transientFailure: true }).modelState).toBe('unknown')
  expect(classifyProbeOutcome({ providerReachable: true, transientFailure: true, status: 401 }).providerState).toBe('invalid_credentials')
  expect(classifyProbeOutcome({ providerReachable: true, transientFailure: true, status: 429 }).providerState).toBe('limited')
})
