import { expect, test } from 'bun:test'
import { fetchOpenAiProbe, classifyProbeOutcome } from './probe.js'

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
