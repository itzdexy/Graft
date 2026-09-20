import { describe, expect, test } from 'bun:test'
import {
  anthropicRequestToOpenAi,
  openAiCompletionToAnthropic,
  openAiStreamToAnthropicEvents,
} from './convert.js'

describe('openaiCompat convert', () => {
  test('uses Nemotron tool mode without leaking reasoning traces', () => {
    const openAi = anthropicRequestToOpenAi({
      model: 'nvidia/nemotron-3-nano-30b-a3b',
      max_tokens: 128,
      messages: [{ role: 'user', content: 'inspect the repo' }],
    })
    expect(openAi.chat_template_kwargs).toEqual({ enable_thinking: false })
  })

  test('disables NIM GLM thinking by default for fast chat', () => {
    const openAi = anthropicRequestToOpenAi({
      model: 'z-ai/glm-5.2',
      max_tokens: 128_000,
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(openAi.chat_template_kwargs).toEqual({ enable_thinking: false })
    expect(openAi.max_tokens).toBeLessThanOrEqual(2048)
  })

  test('maps a forced Graft tool choice for OpenAI-compatible models', () => {
    const openAi = anthropicRequestToOpenAi({
      model: 'nvidia/nemotron-3-nano-30b-a3b',
      max_tokens: 128,
      messages: [{ role: 'user', content: 'what time is it' }],
      tools: [
        {
          name: 'GraftWeb',
          description: 'Live web and runtime data',
          input_schema: { type: 'object', properties: {} },
        },
      ],
      tool_choice: { type: 'tool', name: 'GraftWeb' },
    })
    expect(openAi.tool_choice).toEqual({
      type: 'function',
      function: { name: 'GraftWeb' },
    })
  })

  test('omits tools for weak models without toolCalling', () => {
    const openAi = anthropicRequestToOpenAi({
      model: 'codellama',
      max_tokens: 64,
      messages: [{ role: 'user', content: 'hi' }],
      tools: [
        {
          name: 'GraftWeb',
          description: 'web',
          input_schema: { type: 'object', properties: {} },
        },
      ],
    })
    expect(openAi.tools).toBeUndefined()
    expect(openAi.tool_choice).toBeUndefined()
  })

  test('maps anthropic user message to openai chat', () => {
    const openAi = anthropicRequestToOpenAi({
      model: 'meta/llama-3.1-8b-instruct',
      max_tokens: 128,
      system: 'You are helpful.',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(openAi.model).toBe('meta/llama-3.1-8b-instruct')
    expect(openAi.messages[0]).toEqual({ role: 'system', content: 'You are helpful.' })
    expect(openAi.messages[1]).toEqual({ role: 'user', content: 'hi' })
  })

  test('emits tool results before accompanying user text', () => {
    const openAi = anthropicRequestToOpenAi({
      model: 'm',
      max_tokens: 64,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'and please continue' },
            { type: 'tool_result', tool_use_id: 'call_1', content: '42' },
          ],
        },
      ],
    })
    // tool message must come first so it directly follows the assistant
    // tool_calls turn; the user text follows as a fresh turn.
    expect(openAi.messages[0]?.role).toBe('system')
    expect(openAi.messages[0]?.content).toContain(
      'Tool results are authoritative',
    )
    expect(openAi.messages[1]).toEqual({
      role: 'tool',
      tool_call_id: 'call_1',
      content: '42',
    })
    expect(openAi.messages[2]).toEqual({
      role: 'user',
      content: 'and please continue',
    })
  })

  test('maps pasted images to OpenAI image_url multimodal content', () => {
    const openAi = anthropicRequestToOpenAi({
      model: 'gpt-4o',
      max_tokens: 128,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this screenshot?' },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: 'iVBORw0KGgo=',
              },
            },
          ],
        },
      ],
    })
    expect(openAi.messages[0]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'What is in this screenshot?' },
        {
          type: 'image_url',
          image_url: { url: 'data:image/png;base64,iVBORw0KGgo=' },
        },
      ],
    })
  })

  test('maps image URL sources to OpenAI image_url', () => {
    const openAi = anthropicRequestToOpenAi({
      model: 'm',
      max_tokens: 64,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'url',
                url: 'https://example.com/a.png',
              },
            },
          ],
        },
      ],
    })
    expect(openAi.messages[0]).toEqual({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/a.png' },
        },
      ],
    })
  })

  test('surfaces images inside tool_result as a follow-up user turn', () => {
    const openAi = anthropicRequestToOpenAi({
      model: 'm',
      max_tokens: 64,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'call_img',
              content: [
                { type: 'text', text: 'screenshot captured' },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: '/9j/4AAQ=',
                  },
                },
              ],
            },
          ],
        },
      ],
    })
    expect(openAi.messages[0]?.role).toBe('system')
    expect(openAi.messages[1]).toEqual({
      role: 'tool',
      tool_call_id: 'call_img',
      content: 'screenshot captured',
    })
    expect(openAi.messages[2]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: '[Image from tool result]' },
        {
          type: 'image_url',
          image_url: { url: 'data:image/jpeg;base64,/9j/4AAQ=' },
        },
      ],
    })
  })
})

function sseStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`data: ${line}\n\n`))
      }
      controller.close()
    },
  })
}

async function collectEvents(
  gen: AsyncGenerator<string>,
): Promise<Array<{ event: string; data: Record<string, unknown> }>> {
  const events: Array<{ event: string; data: Record<string, unknown> }> = []
  for await (const raw of gen) {
    const eventMatch = raw.match(/event: (.*)/)
    const dataMatch = raw.match(/data: (.*)/)
    if (eventMatch && dataMatch) {
      events.push({ event: eventMatch[1]!, data: JSON.parse(dataMatch[1]!) })
    }
  }
  return events
}

describe('openaiCompat convert: completion → Graft', () => {
  test('maps tool_calls to tool_use with the right stop_reason and usage', () => {
    const out = openAiCompletionToAnthropic(
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_9',
                  type: 'function',
                  function: { name: 'write', arguments: '{"x":1}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 7 },
      },
      'gpt-4o',
    )
    expect(out.stop_reason).toBe('tool_use')
    const blocks = out.content as Array<{ type: string; input?: unknown }>
    expect(blocks[0]?.type).toBe('tool_use')
    expect(blocks[0]?.input).toEqual({ x: 1 })
    expect((out.usage as Record<string, number>).output_tokens).toBe(7)
  })

  test('infers tool_use stop_reason even when provider reports finish_reason "stop"', () => {
    // NVIDIA NIM / vLLM / llama.cpp often return finish_reason 'stop' alongside
    // tool_calls. The presence of a tool call must still produce tool_use.
    const out = openAiCompletionToAnthropic(
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'read', arguments: '{}' },
                },
              ],
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 3, completion_tokens: 4 },
      },
      'nim-model',
    )
    expect(out.stop_reason).toBe('tool_use')
    expect((out.usage as Record<string, number>).input_tokens).toBe(3)
  })

  test('maps reasoning_content onto a thinking block before text', () => {
    const out = openAiCompletionToAnthropic(
      {
        choices: [
          {
            message: {
              role: 'assistant',
              reasoning_content: 'step by step',
              content: 'answer',
            },
            finish_reason: 'stop',
          },
        ],
      },
      'z-ai/glm-5.2',
    )
    const blocks = out.content as Array<{ type: string; thinking?: string; text?: string }>
    expect(blocks[0]).toEqual({ type: 'thinking', thinking: 'step by step' })
    expect(blocks[1]).toEqual({ type: 'text', text: 'answer' })
  })

  test('length truncation still maps to max_tokens even with a tool call', () => {
    const out = openAiCompletionToAnthropic(
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'c',
                  type: 'function',
                  function: { name: 'x', arguments: '{' },
                },
              ],
            },
            finish_reason: 'length',
          },
        ],
      },
      'm',
    )
    expect(out.stop_reason).toBe('max_tokens')
  })
})

describe('openaiCompat convert: streaming', () => {
  test('text then two tool calls get distinct, properly closed block indices', async () => {
    const events = await collectEvents(
      openAiStreamToAnthropicEvents(
        sseStream([
          JSON.stringify({ choices: [{ delta: { content: 'Hello' } }] }),
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, id: 'call_a', function: { name: 'read', arguments: '{"p":1}' } },
                  ],
                },
              },
            ],
          }),
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 1, id: 'call_b', function: { name: 'write', arguments: '{"q":2}' } },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }),
          '[DONE]',
        ]),
        'gpt-4o',
      ),
    )

    const starts = events.filter(e => e.event === 'content_block_start')
    const stops = events.filter(e => e.event === 'content_block_stop')

    // Three blocks: text(0), tool(1), tool(2) — all distinct.
    expect(starts.map(s => s.data.index)).toEqual([0, 1, 2])

    // Every opened block is closed exactly once.
    expect(stops.length).toBe(3)
    expect(
      stops.map(s => s.data.index as number).sort((a, b) => a - b),
    ).toEqual([0, 1, 2])

    // Tool blocks carry distinct ids (regression: previously collided on idx 0).
    const ids = starts
      .filter(s => (s.data.content_block as { type: string }).type === 'tool_use')
      .map(s => (s.data.content_block as { id: string }).id)
    expect(ids).toEqual(['call_a', 'call_b'])

    // stop_reason reflects tool use, not a hardcoded end_turn.
    const messageDelta = events.find(e => e.event === 'message_delta')
    expect((messageDelta?.data.delta as { stop_reason: string }).stop_reason).toBe('tool_use')
  })

  test('a stream ending on a tool call still closes the tool block', async () => {
    const events = await collectEvents(
      openAiStreamToAnthropicEvents(
        sseStream([
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, id: 'call_x', function: { name: 'run', arguments: '{}' } },
                  ],
                },
              },
            ],
          }),
          // stream ends without an explicit [DONE]
        ]),
        'gpt-4o',
      ),
    )

    const starts = events.filter(e => e.event === 'content_block_start')
    const stops = events.filter(e => e.event === 'content_block_stop')
    expect(starts.length).toBe(1)
    expect(stops.length).toBe(1)
    expect(stops[0]!.data.index).toBe(0)
    expect(events.at(-1)?.event).toBe('message_stop')
  })

  test('streaming tool call with finish_reason "stop" still reports tool_use', async () => {
    const events = await collectEvents(
      openAiStreamToAnthropicEvents(
        sseStream([
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    { index: 0, id: 'call_s', function: { name: 'run', arguments: '{}' } },
                  ],
                },
                finish_reason: 'stop',
              },
            ],
          }),
          '[DONE]',
        ]),
        'nim-model',
      ),
    )
    const messageDelta = events.find(e => e.event === 'message_delta')
    expect((messageDelta?.data.delta as { stop_reason: string }).stop_reason).toBe(
      'tool_use',
    )
  })

  test('maps OpenAI reasoning_content deltas to Anthropic thinking blocks', async () => {
    const events = await collectEvents(
      openAiStreamToAnthropicEvents(
        sseStream([
          JSON.stringify({
            choices: [{ delta: { reasoning_content: 'ponder' } }],
          }),
          JSON.stringify({
            choices: [{ delta: { reasoning_content: 'ing…' } }],
          }),
          JSON.stringify({
            choices: [{ delta: { content: 'hi' }, finish_reason: 'stop' }],
          }),
          '[DONE]',
        ]),
        'z-ai/glm-5.2',
      ),
    )

    const starts = events.filter(e => e.event === 'content_block_start')
    expect(
      starts.map(s => (s.data.content_block as { type: string }).type),
    ).toEqual(['thinking', 'text'])

    const thinkingDeltas = events
      .filter(e => e.event === 'content_block_delta')
      .map(e => e.data.delta as { type: string; thinking?: string })
      .filter(d => d.type === 'thinking_delta')
      .map(d => d.thinking)
    expect(thinkingDeltas.join('')).toBe('pondering…')

    const textDeltas = events
      .filter(e => e.event === 'content_block_delta')
      .map(e => e.data.delta as { type: string; text?: string })
      .filter(d => d.type === 'text_delta')
      .map(d => d.text)
    expect(textDeltas.join('')).toBe('hi')
  })

  test('passes prompt_tokens through as input_tokens in usage', async () => {
    const events = await collectEvents(
      openAiStreamToAnthropicEvents(
        sseStream([
          JSON.stringify({ choices: [{ delta: { content: 'hi' } }] }),
          JSON.stringify({
            choices: [{ delta: {}, finish_reason: 'stop' }],
            usage: { prompt_tokens: 11, completion_tokens: 2 },
          }),
          '[DONE]',
        ]),
        'gpt-4o',
      ),
    )
    const messageDelta = events.find(e => e.event === 'message_delta')
    const usage = messageDelta?.data.usage as Record<string, number>
    expect(usage.input_tokens).toBe(11)
    expect(usage.output_tokens).toBe(2)
  })

  test('normalizes aliased tool names and repairs split, newline-containing args', async () => {
    const frag1 = '{"file_path":"a.html","content":"<h1>x</h1>'
    const frag2 = '\n<p>y</p>"}' // literal newline → invalid JSON until repaired
    const events = await collectEvents(
      openAiStreamToAnthropicEvents(
        sseStream([
          JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: 'call_w',
                      function: { name: 'write_file', arguments: frag1 },
                    },
                  ],
                },
              },
            ],
          }),
          JSON.stringify({
            choices: [
              {
                delta: { tool_calls: [{ index: 0, function: { arguments: frag2 } }] },
                finish_reason: 'tool_calls',
              },
            ],
          }),
          '[DONE]',
        ]),
        'nim-model',
      ),
    )

    // Alias mapped to the canonical tool name on the content_block_start.
    const toolStart = events.find(
      e =>
        e.event === 'content_block_start' &&
        (e.data.content_block as { type: string }).type === 'tool_use',
    )
    expect((toolStart?.data.content_block as { name: string }).name).toBe('Write')
    expect((toolStart?.data.content_block as { id: string }).id).toBe('call_w')

    // The buffered args are emitted as valid, parseable JSON.
    const argJson = events
      .filter(
        e =>
          e.event === 'content_block_delta' &&
          (e.data.delta as { type: string }).type === 'input_json_delta',
      )
      .map(e => (e.data.delta as { partial_json: string }).partial_json)
      .join('')
    expect(JSON.parse(argJson)).toEqual({
      file_path: 'a.html',
      content: '<h1>x</h1>\n<p>y</p>',
    })

    const messageDelta = events.find(e => e.event === 'message_delta')
    expect((messageDelta?.data.delta as { stop_reason: string }).stop_reason).toBe(
      'tool_use',
    )
  })

  test('an empty stream still opens with message_start before message_stop', async () => {
    const events = await collectEvents(
      openAiStreamToAnthropicEvents(sseStream(['[DONE]']), 'gpt-4o'),
    )
    expect(events[0]?.event).toBe('message_start')
    expect(events.at(-1)?.event).toBe('message_stop')
  })
})
