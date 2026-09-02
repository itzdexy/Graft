import { randomUUID } from 'node:crypto'
import { assertNormalizedRequest, type NormalizedModelRequest, type NormalizedProviderStreamEvent } from '../../types.js'
import { buildNormalizedRequest, normalizeMessage } from './normalize.js'

export function decodeOpenAiChatRequest(value: unknown): NormalizedModelRequest {
  const body = (value && typeof value === 'object' ? value : {}) as Record<string, any>
  return assertNormalizedRequest(buildNormalizedRequest(body, Array.isArray(body.messages) ? body.messages.map(normalizeMessage) : []))
}

function materialize(model: string, events: NormalizedProviderStreamEvent[]): { text: string; reasoning: string; toolCalls: Array<{ id: string; name: string; arguments: string }>; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }; stopReason: string } {
  let text = ''; let reasoning = ''; const calls = new Map<string, { id: string; name: string; arguments: string }>(); let usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined; let stopReason = 'stop'
  for (const event of events) {
    if (event.type === 'text_delta') text += event.text
    else if (event.type === 'reasoning_delta' || event.type === 'reasoning_summary_delta') reasoning += event.text
    else if (event.type === 'tool_start') calls.set(event.id, { id: event.id, name: event.name, arguments: '' })
    else if (event.type === 'tool_delta') calls.set(event.id, { ...(calls.get(event.id) || { id: event.id, name: '', arguments: '' }), arguments: (calls.get(event.id)?.arguments || '') + event.argumentsDelta })
    else if (event.type === 'usage') { const input = event.inputTokens || 0; const output = event.outputTokens || 0; usage = { prompt_tokens: input, completion_tokens: output, total_tokens: input + output } }
    else if (event.type === 'complete') stopReason = event.stopReason === 'tool_use' ? 'tool_calls' : event.stopReason || stopReason
  }
  return { text, reasoning, toolCalls: [...calls.values()], usage, stopReason }
}

export function encodeOpenAiChatJson(model: string, events: NormalizedProviderStreamEvent[]): Record<string, unknown> {
  const output = materialize(model, events)
  const message: Record<string, unknown> = { role: 'assistant', content: output.text || null }
  if (output.reasoning) message.reasoning_content = output.reasoning
  if (output.toolCalls.length) message.tool_calls = output.toolCalls.map(call => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }))
  return { id: `chatcmpl-${randomUUID()}`, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, message, finish_reason: output.toolCalls.length ? 'tool_calls' : output.stopReason }], usage: output.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }
}

function frame(value: unknown): Uint8Array { return new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`) }

export function encodeOpenAiChatStream(model: string, events: AsyncIterable<NormalizedProviderStreamEvent>): ReadableStream<Uint8Array> {
  return new ReadableStream({ async start(controller) {
    const id = `chatcmpl-${randomUUID()}`; const created = Math.floor(Date.now() / 1000); const calls = new Set<string>()
    controller.enqueue(frame({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }] }))
    try {
      for await (const event of events) {
        if (event.type === 'text_delta') controller.enqueue(frame({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { content: event.text }, finish_reason: null }] }))
        else if (event.type === 'reasoning_delta' || event.type === 'reasoning_summary_delta') controller.enqueue(frame({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { reasoning_content: event.text }, finish_reason: null }] }))
        else if (event.type === 'tool_start') { calls.add(event.id); controller.enqueue(frame({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: event.id, type: 'function', function: { name: event.name, arguments: '' } }] }, finish_reason: null }] })) }
        else if (event.type === 'tool_delta') controller.enqueue(frame({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: event.id, type: 'function', function: { arguments: event.argumentsDelta } }] }, finish_reason: null }] }))
        else if (event.type === 'usage') controller.enqueue(frame({ id, object: 'chat.completion.chunk', created, model, choices: [], usage: { prompt_tokens: event.inputTokens || 0, completion_tokens: event.outputTokens || 0, total_tokens: (event.inputTokens || 0) + (event.outputTokens || 0) } }))
        else if (event.type === 'error') controller.enqueue(frame({ error: { message: event.message, type: event.kind } }))
        else if (event.type === 'complete') controller.enqueue(frame({ id, object: 'chat.completion.chunk', created, model, choices: [{ index: 0, delta: {}, finish_reason: calls.size ? 'tool_calls' : event.stopReason || 'stop' }] }))
      }
      controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); controller.close()
    } catch (error) { controller.enqueue(frame({ error: { message: error instanceof Error ? error.message : 'stream failed', type: 'gateway_error' } })); controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n')); controller.close() }
  } })
}
