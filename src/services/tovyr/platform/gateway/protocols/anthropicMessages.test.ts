import { describe, expect, test } from 'bun:test'
import { decodeAnthropicMessagesRequest, encodeAnthropicMessagesJson, encodeAnthropicMessagesStream } from './anthropicMessages.js'

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader(); const decoder = new TextDecoder(); let output = ''
  for (;;) { const next = await reader.read(); if (next.done) return output; output += decoder.decode(next.value, { stream: true }) }
}

describe('Anthropic Messages codec', () => {
  test('decodes system blocks and tool use/results', () => {
    const request = decodeAnthropicMessagesRequest({
      model: 'anthropic::claude-sonnet-5',
      system: [{ type: 'text', text: 'Be concise.' }],
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Find it' }, { type: 'tool_result', tool_use_id: 'call_1', content: 'done' }] },
        { role: 'assistant', content: [{ type: 'tool_use', id: 'call_1', name: 'search', input: { q: 'x' } }] },
      ],
      tools: [{ name: 'search', description: 'Search', input_schema: { type: 'object' } }],
      tool_choice: { type: 'tool', name: 'search' },
      max_tokens: 512,
      stream: true,
    })
    expect(request.messages[0].role).toBe('system')
    expect(request.messages[0].content[0]).toEqual({ type: 'text', text: 'Be concise.' })
    expect(request.messages[1].content[1]).toEqual({ type: 'tool_result', toolCallId: 'call_1', content: 'done' })
    expect(request.messages[2].content[0]).toEqual({ type: 'tool_call', id: 'call_1', name: 'search', arguments: { q: 'x' } })
    expect(request.toolChoice).toEqual({ type: 'tool', name: 'search' })
  })

  test('emits Anthropic message events and non-stream JSON', async () => {
    const events = [
      { type: 'text_delta', text: 'Hello' } as const,
      { type: 'usage', inputTokens: 2, outputTokens: 1 } as const,
      { type: 'complete', stopReason: 'end_turn' } as const,
    ]
    const stream = await readStream(encodeAnthropicMessagesStream('claude', (async function* () { yield* events })()))
    expect(stream).toContain('event: message_start')
    expect(stream).toContain('event: content_block_delta')
    expect(stream).toContain('"type":"text_delta"')
    expect(stream).toContain('event: message_stop')
    const json = encodeAnthropicMessagesJson('claude', events)
    expect(json.type).toBe('message')
    expect((json.content as any[])[0]).toEqual({ type: 'text', text: 'Hello' })
    expect((json.usage as any).input_tokens).toBe(2)
  })
})
