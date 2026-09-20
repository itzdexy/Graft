import { describe, expect, test } from 'bun:test'
import { serializeAnthropicMessages } from './anthropicCompatible.js'
import { serializeOpenAiMessages } from './openAiCompatible.js'
import type { NormalizedModelRequest } from '../types.js'

const request: NormalizedModelRequest = {
  model: 'provider::model',
  messages: [
    { role: 'system', content: [{ type: 'text', text: 'system' }] },
    { role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image', mediaType: 'image/png', data: 'abc' }] },
    { role: 'assistant', content: [{ type: 'tool_call', id: 'call_1', name: 'search', arguments: { q: 'x' } }] },
    { role: 'tool', content: [{ type: 'tool_result', toolCallId: 'call_1', content: 'done' }] },
  ],
  tools: [{ name: 'search', description: 'Search', inputSchema: { type: 'object' } }],
  stream: true,
}

describe('provider wire serializers', () => {
  test('maps normalized messages to OpenAI content and tool fields', () => {
    const messages = serializeOpenAiMessages(request)
    expect(messages[1].content).toEqual([{ type: 'text', text: 'look' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } }])
    expect(messages[2].tool_calls).toEqual([{ id: 'call_1', type: 'function', function: { name: 'search', arguments: '{"q":"x"}' } }])
    expect(messages[3]).toEqual({ role: 'tool', tool_call_id: 'call_1', content: 'done' })
  })

  test('maps normalized messages to Anthropic system, image, and tool blocks', () => {
    const serialized = serializeAnthropicMessages(request)
    expect(serialized.system).toBe('system')
    expect(serialized.messages[0].content).toEqual([{ type: 'text', text: 'look' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'abc' } }])
    expect(serialized.messages[1].content).toEqual([{ type: 'tool_use', id: 'call_1', name: 'search', input: { q: 'x' } }])
    expect(serialized.messages[2].content).toEqual([{ type: 'tool_result', tool_use_id: 'call_1', content: 'done', is_error: false }])
  })
})
