import { expect, test } from 'bun:test'
import { fetchPagedModelPayload } from './modelDiscovery.js'

test('Anthropic pagination collects all pages without following untrusted URLs', async () => {
  const original = globalThis.fetch
  const urls: string[] = []
  globalThis.fetch = (async (url, init) => {
    urls.push(String(url))
    expect(init?.redirect).toBe('error')
    expect(new Headers(init?.headers).get('x-api-key')).toBe('fixture')
    return Response.json(urls.length === 1 ? { data: [{ id: 'first' }], has_more: true, last_id: 'first', next: 'https://untrusted.invalid/steal' } : { data: [{ id: 'second' }], has_more: false })
  }) as typeof fetch
  try {
    expect(await fetchPagedModelPayload('https://provider.invalid/v1/models', { headers: { 'x-api-key': 'fixture' } })).toEqual({ data: [{ id: 'first' }, { id: 'second' }] })
    expect(urls).toEqual(['https://provider.invalid/v1/models', 'https://provider.invalid/v1/models?after_id=first'])
  } finally { globalThis.fetch = original }
})

test('Gemini page tokens and bare-array model lists are supported', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async url => Response.json(String(url).includes('pageToken=next') ? { models: [{ name: 'models/two' }] } : { models: [{ name: 'models/one' }], nextPageToken: 'next' })) as typeof fetch
  try {
    expect(await fetchPagedModelPayload('https://provider.invalid/models', {})).toEqual({ models: [{ name: 'models/one' }, { name: 'models/two' }] })
    globalThis.fetch = (async () => Response.json([{ id: 'bare' }])) as typeof fetch
    expect(await fetchPagedModelPayload('https://provider.invalid/models', {})).toEqual({ data: [{ id: 'bare' }] })
  } finally { globalThis.fetch = original }
})

test('failed later pages and cursor loops never return a partial success', async () => {
  const original = globalThis.fetch
  globalThis.fetch = (async url => String(url).includes('after_id') ? new Response('', { status: 401 }) : Response.json({ data: [{ id: 'first' }], has_more: true, last_id: 'first' })) as typeof fetch
  try {
    await expect(fetchPagedModelPayload('https://provider.invalid/models', {})).rejects.toThrow('HTTP 401')
    globalThis.fetch = (async () => Response.json({ data: [], has_more: true, last_id: 'repeat' })) as typeof fetch
    await expect(fetchPagedModelPayload('https://provider.invalid/models', {})).rejects.toThrow('repeated a cursor')
    const controller = new AbortController(); controller.abort()
    await expect(fetchPagedModelPayload('https://provider.invalid/models', { signal: controller.signal })).rejects.toThrow()
  } finally { globalThis.fetch = original }
})
