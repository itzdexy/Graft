import { expect, test } from 'bun:test'
import { anthropicRequestToOpenAi, openAiStreamToAnthropicEvents } from './convert.js'
import { chatToResponses, responseToChat, responsesToChatStream, usesResponsesApi } from './responses.js'
import { ensureOpenAiCompatProxySync, stopOpenAiCompatProxy } from './proxy.js'

test('native reasoning requests use the correct budget and omit unsupported sampling', () => {
  for (const model of ['gpt-6-astra', 'gpt-5.6-terra', 'o3']) {
    const request = anthropicRequestToOpenAi({ model, max_tokens: 1024, temperature: 0, top_p: 0.9, messages: [{ role: 'user', content: 'Hello' }] }, 'openai')
    expect(request.max_completion_tokens).toBe(1024)
    expect(request.max_tokens).toBeUndefined()
    expect(request.temperature).toBeUndefined()
    expect(request.top_p).toBeUndefined()
  }
  expect(usesResponsesApi('openai', 'gpt-6-astra')).toBe(true)
  expect(usesResponsesApi('openrouter', 'openai/gpt-6-astra')).toBe(false)
})

test('Responses preserves function calls, outputs, images and opt-out of storage', () => {
  const chat = anthropicRequestToOpenAi({ model: 'gpt-6-astra', max_tokens: 1024, stream: true, messages: [
    { role: 'assistant', content: [{ type: 'tool_use', id: 'call_one', name: 'Read', input: { file_path: 'README.md' } }] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_one', content: 'Fixture' }, { type: 'image', source: { type: 'url', url: 'https://example.invalid/fixture.png' } }] },
  ], tools: [{ name: 'Read', input_schema: { type: 'object' } }] }, 'openai')
  const request = chatToResponses(chat)
  expect(request.store).toBe(false)
  expect(request.input.find(i => i.type === 'function_call')).toMatchObject({ type: 'function_call', call_id: 'call_one', name: 'Read' })
  expect(request.input.find(i => i.type === 'function_call_output')).toEqual({ type: 'function_call_output', call_id: 'call_one', output: 'Fixture' })
  expect(request.input.some(i => Array.isArray(i.content) && i.content[0]?.type === 'input_image')).toBe(true)
  expect(request.tools?.[0]).toMatchObject({ type: 'function', name: 'Read', strict: false })
})

function streamEvents(events: unknown[]) {
  const bytes = new TextEncoder().encode(events.map(e => `data: ${JSON.stringify(e)}\n\n`).join(''))
  let cursor = 0
  return new ReadableStream<Uint8Array>({ pull(controller) {
    if (cursor >= bytes.length) { controller.close(); return }
    controller.enqueue(bytes.slice(cursor, cursor += 7))
  } })
}

test('fragmented Responses text and tool arguments reach the agent with stable IDs', async () => {
  const stream = responsesToChatStream(streamEvents([
    { type: 'response.output_text.delta', delta: 'Checking…' },
    { type: 'response.output_item.added', output_index: 2, item: { type: 'function_call', call_id: 'call_one', name: 'Read', arguments: '' } },
    { type: 'response.function_call_arguments.delta', output_index: 2, delta: '{"file_path":' },
    { type: 'response.function_call_arguments.delta', output_index: 2, delta: '"README.md"}' },
    { type: 'response.function_call_arguments.done', output_index: 2, arguments: '{"file_path":"README.md"}' },
    { type: 'response.completed', response: { usage: { input_tokens: 20, output_tokens: 10 } } },
  ]))
  let result = ''
  for await (const event of openAiStreamToAnthropicEvents(stream, 'gpt-6-astra')) result += event
  expect(result).toContain('Checking…')
  expect(result).toContain('call_one')
  expect(result).toContain('tool_use')
  expect(result).toContain('README.md')
  expect(result).toContain('message_stop')
})

test('failed and abruptly closed Responses streams never become successful replies', async () => {
  for (const events of [[{ type: 'response.failed' }], [{ type: 'response.output_text.delta', delta: 'Partial' }]]) {
    await expect(new Response(responsesToChatStream(streamEvents(events))).text()).rejects.toThrow()
  }
  expect(responseToChat({ status: 'incomplete', output: [{ type: 'function_call', call_id: 'c', name: 'Read', arguments: '{}' }] }).choices[0]?.finish_reason).toBe('length')
  expect(() => responseToChat({ status: 'failed' })).toThrow()
})

test('the real local proxy routes Astra tools through Responses and returns their IDs', async () => {
  const routes: string[] = []
  const upstream = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(req) {
    routes.push(new URL(req.url).pathname)
    const body = await req.json()
    expect(body.store).toBe(false)
    expect(body.tools[0].name).toBe('Read')
    expect(body.temperature).toBeUndefined()
    return Response.json({ id: 'resp_fixture', status: 'completed', output: [{ type: 'function_call', call_id: 'fixture_call', name: 'Read', arguments: '{"file_path":"README.md"}' }] })
  } })
  try {
    const base = ensureOpenAiCompatProxySync({ providerId: 'openai', upstreamBaseUrl: `http://127.0.0.1:${upstream.port}/v1`, upstreamApiKey: 'fixture-only' })
    const response = await fetch(`${base}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: 'gpt-6-astra', max_tokens: 1024, messages: [{ role: 'user', content: 'Read the fixture' }], tools: [{ name: 'Read', input_schema: { type: 'object' } }] }) })
    expect(response.status).toBe(200)
    const result = await response.json()
    expect(result.content[0]).toMatchObject({ type: 'tool_use', id: 'fixture_call', name: 'Read', input: { file_path: 'README.md' } })
    expect(routes).toEqual(['/v1/responses'])
  } finally { stopOpenAiCompatProxy(); upstream.stop(true) }
})
