import { describe, expect, test } from 'bun:test'
import { anthropicCompatibleAdapter } from './anthropicCompatible.js'
import { openAiCompatibleAdapter } from './openAiCompatible.js'

const selection = {
  providerId: 'test',
  providerLabel: 'Test',
  modelId: 'model',
  baseUrl: 'https://example.test',
  apiKey: 'secret',
  authMode: 'apiKey' as const,
  protocol: 'openai' as const,
}
const request = {
  model: 'model',
  messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Hi' }] }],
  stream: true,
}

describe('provider stream completion', () => {
  test('synthesizes completion when OpenAI upstream closes without DONE', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n', { headers: { 'content-type': 'text/event-stream' } })) as typeof fetch
    try {
      const events = []
      for await (const event of openAiCompatibleAdapter.stream(selection, request, new AbortController().signal)) events.push(event)
      expect(events).toEqual([{ type: 'text_delta', text: 'Hi' }, { type: 'complete', stopReason: 'stop' }])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('synthesizes completion when Anthropic upstream closes without message_stop', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n', { headers: { 'content-type': 'text/event-stream' } })) as typeof fetch
    try {
      const events = []
      for await (const event of anthropicCompatibleAdapter.stream({ ...selection, protocol: 'anthropic' }, request, new AbortController().signal)) events.push(event)
      expect(events).toEqual([{ type: 'text_delta', text: 'Hi' }, { type: 'complete', stopReason: undefined }])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('normalizes provider rate-limit errors for clients', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response(JSON.stringify({ status: 429, title: 'Too Many Requests' }), { status: 429 })) as typeof fetch
    try {
      const events = []
      for await (const event of openAiCompatibleAdapter.stream(selection, request, new AbortController().signal)) events.push(event)
      expect(events).toEqual([{ type: 'error', kind: 'upstream_http', message: 'Too Many Requests', retryable: true }])
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('retries once without tools when an OpenAI provider rejects tool schemas', async () => {
    const originalFetch = globalThis.fetch
    const requests: string[] = []
    globalThis.fetch = (async (_input, init) => {
      requests.push(String(init?.body || ''))
      if (requests.length === 1) {
        return new Response('data: {"error":{"type":"internal_server_error","message":"Internal server error"}}\n\n', { headers: { 'content-type': 'text/event-stream' } })
      }
      return new Response('data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } })
    }) as typeof fetch
    try {
      const events = []
      const toolRequest = { ...request, tools: [{ name: 'exec', inputSchema: { type: 'object' } }] }
      for await (const event of openAiCompatibleAdapter.stream(selection, toolRequest, new AbortController().signal)) events.push(event)
      expect(events).toEqual([{ type: 'text_delta', text: 'OK' }, { type: 'complete', stopReason: 'stop' }])
      expect(JSON.parse(requests[0]).tools).toHaveLength(1)
      expect(JSON.parse(requests[1]).tools).toBeUndefined()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
