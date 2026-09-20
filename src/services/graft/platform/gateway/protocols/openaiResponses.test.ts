import { describe, expect, test } from 'bun:test'
import { decodeOpenAiResponsesRequest, encodeOpenAiResponsesJson, encodeOpenAiResponsesStream } from './openaiResponses.js'

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader(); const decoder = new TextDecoder(); let output = ''
  for (;;) { const next = await reader.read(); if (next.done) return output; output += decoder.decode(next.value, { stream: true }) }
}

describe('OpenAI Responses codec', () => {
  test('decodes string and typed input plus function tools', () => {
    const request = decodeOpenAiResponsesRequest({
      model: 'openrouter::moonshotai/kimi-k3',
      input: [
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Hi' }] },
        { type: 'function_call_output', call_id: 'call_1', output: 'done' },
      ],
      tools: [{ type: 'function', name: 'search', description: 'Search', parameters: { type: 'object' } }],
      reasoning: { effort: 'high' },
      max_output_tokens: 321,
      stream: true,
    })
    expect(request.messages[0].content[0]).toEqual({ type: 'text', text: 'Hi' })
    expect(request.messages[1].content[0]).toEqual({ type: 'tool_result', toolCallId: 'call_1', content: 'done' })
    expect(request.tools?.[0].name).toBe('search')
    expect(request.effort).toBe('high')
    expect(request.maxOutputTokens).toBe(321)
  })

  test('emits Responses events and JSON', async () => {
    const events = [
      { type: 'text_delta', text: 'Hello' } as const,
      { type: 'complete', stopReason: 'stop' } as const,
    ]
    const stream = await readStream(encodeOpenAiResponsesStream('kimi', (async function* () { yield* events })()))
    expect(stream).toContain('response.created')
    expect(stream).toContain('response.output_item.added')
    expect(stream).toContain('response.content_part.added')
    expect(stream).toContain('response.output_text.delta')
    expect(stream.indexOf('response.output_item.added')).toBeLessThan(stream.indexOf('response.output_text.delta'))
    expect(stream.indexOf('response.content_part.added')).toBeLessThan(stream.indexOf('response.output_text.delta'))
    expect(stream).toContain('response.output_text.done')
    expect(stream).toContain('response.content_part.done')
    expect(stream).toContain('response.output_item.done')
    expect(stream).toContain('response.completed')
    const json = encodeOpenAiResponsesJson('kimi', events)
    expect(json.object).toBe('response')
    expect(json.output_text).toBe('Hello')
  })

  test('terminates failed streams with response.failed', async () => {
    const stream = await readStream(encodeOpenAiResponsesStream('kimi', (async function* () {
      yield { type: 'error', kind: 'upstream_http', message: 'rate limited', retryable: true } as const
    })()))
    expect(stream).toContain('response.failed')
    // Older Codex clients only close their stream state on response.completed;
    // include a failed terminal response for compatibility with those clients.
    expect(stream).toContain('response.completed')
    expect(stream).toContain('"status":"failed"')
  })
})
