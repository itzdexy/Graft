import { describe, expect, test } from 'bun:test'
import { decodeOpenAiChatRequest, encodeOpenAiChatJson, encodeOpenAiChatStream } from './openaiChat.js'

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let output = ''
  for (;;) {
    const next = await reader.read()
    if (next.done) return output
    output += decoder.decode(next.value, { stream: true })
  }
}

describe('OpenAI Chat Completions codec', () => {
  test('decodes multimodal messages, tools, tool choice, and limits', () => {
    const request = decodeOpenAiChatRequest({
      model: 'openrouter::moonshotai/kimi-k3',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: [{ type: 'text', text: 'Look' }, { type: 'image_url', image_url: { url: 'https://example.test/a.png' } }] },
        { role: 'assistant', content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'search', arguments: '{"q":"x"}' } }] },
        { role: 'tool', tool_call_id: 'call_1', content: 'result' },
      ],
      tools: [{ type: 'function', function: { name: 'search', description: 'Search', parameters: { type: 'object' } } }],
      tool_choice: { type: 'function', function: { name: 'search' } },
      max_tokens: 123,
      temperature: 0.2,
      top_p: 0.8,
      stop: ['END'],
      stream: true,
    })

    expect(request.model).toBe('openrouter::moonshotai/kimi-k3')
    expect(request.messages[1].content[1]).toEqual({ type: 'image', url: 'https://example.test/a.png', mediaType: 'image/*' })
    expect(request.messages[2].content[0]).toEqual({ type: 'tool_call', id: 'call_1', name: 'search', arguments: { q: 'x' } })
    expect(request.tools?.[0].inputSchema).toEqual({ type: 'object' })
    expect(request.toolChoice).toEqual({ type: 'tool', name: 'search' })
    expect(request.maxOutputTokens).toBe(123)
    expect(request.stream).toBe(true)
    expect(decodeOpenAiChatRequest({ model: 'kimi', messages: [{ role: 'user', content: 'hi' }] }).stream).toBe(false)
  })

  test('encodes streamed text, fragmented tool calls, usage, completion, and DONE', async () => {
    const events = [
      { type: 'text_delta', text: 'Hi' } as const,
      { type: 'tool_start', id: 'call_1', name: 'search' } as const,
      { type: 'tool_delta', id: 'call_1', argumentsDelta: '{"q"' } as const,
      { type: 'tool_delta', id: 'call_1', argumentsDelta: ':"x"}' } as const,
      { type: 'usage', inputTokens: 4, outputTokens: 3 } as const,
      { type: 'complete', stopReason: 'stop' } as const,
    ]
    const stream = await readStream(encodeOpenAiChatStream('kimi', (async function* () { yield* events })()))
    expect(stream).toContain('"content":"Hi"')
    expect(stream).toContain('"tool_calls"')
    expect(stream).toContain('"finish_reason":"tool_calls"')
    expect(stream).toContain('"prompt_tokens":4')
    expect(stream).toContain('data: [DONE]')

    const json = encodeOpenAiChatJson('kimi', events)
    expect((json.choices as any[])[0].message.content).toBe('Hi')
    expect((json.choices as any[])[0].message.tool_calls[0].function.arguments).toBe('{"q":"x"}')
    expect((json.usage as any).total_tokens).toBe(7)
  })
})
