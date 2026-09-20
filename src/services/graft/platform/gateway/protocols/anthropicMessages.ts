import { randomUUID } from 'node:crypto'
import { assertNormalizedRequest, type NormalizedModelRequest, type NormalizedProviderStreamEvent } from '../../types.js'
import { buildNormalizedRequest, normalizeContent, normalizeMessage } from './normalize.js'

export function decodeAnthropicMessagesRequest(value: unknown): NormalizedModelRequest {
  const body = (value && typeof value === 'object' ? value : {}) as Record<string, any>
  const messages = Array.isArray(body.messages) ? body.messages.map(normalizeMessage) : []
  if (body.system) messages.unshift({ role: 'system', content: normalizeContent(body.system) })
  return assertNormalizedRequest(buildNormalizedRequest(body, messages))
}

function materialize(model: string, events: NormalizedProviderStreamEvent[]) {
  let text = ''; const tools = new Map<string, { id: string; name: string; input: string }>(); let inputTokens = 0; let outputTokens = 0; let stopReason = 'end_turn'
  for (const event of events) {
    if (event.type === 'text_delta') text += event.text
    else if (event.type === 'tool_start') tools.set(event.id, { id: event.id, name: event.name, input: '' })
    else if (event.type === 'tool_delta') { const current = tools.get(event.id) || { id: event.id, name: '', input: '' }; current.input += event.argumentsDelta; tools.set(event.id, current) }
    else if (event.type === 'usage') { inputTokens = event.inputTokens || inputTokens; outputTokens = event.outputTokens || outputTokens }
    else if (event.type === 'complete') stopReason = event.stopReason === 'tool_use' || tools.size ? 'tool_use' : event.stopReason || stopReason
  }
  return { text, tools: [...tools.values()], inputTokens, outputTokens, stopReason }
}

function parseJson(value: string): unknown { try { return JSON.parse(value || '{}') } catch { return {} } }

export function encodeAnthropicMessagesJson(model: string, events: NormalizedProviderStreamEvent[]): Record<string, unknown> {
  const output = materialize(model, events); const content: Record<string, unknown>[] = []
  if (output.text) content.push({ type: 'text', text: output.text })
  for (const call of output.tools) content.push({ type: 'tool_use', id: call.id, name: call.name, input: parseJson(call.input) })
  return { id: `msg_${randomUUID()}`, type: 'message', role: 'assistant', model, content, stop_reason: output.stopReason, stop_sequence: null, usage: { input_tokens: output.inputTokens, output_tokens: output.outputTokens } }
}

function event(name: string, payload: Record<string, unknown>): Uint8Array { return new TextEncoder().encode(`event: ${name}\ndata: ${JSON.stringify({ type: name, ...payload })}\n\n`) }

export function encodeAnthropicMessagesStream(model: string, events: AsyncIterable<NormalizedProviderStreamEvent>): ReadableStream<Uint8Array> {
  return new ReadableStream({ async start(controller) {
    const messageId = `msg_${randomUUID()}`; let nextBlockIndex = 0; let textIndex: number | undefined; const toolIndexes = new Map<string, number>(); const startedIndexes = new Set<number>(); let inputTokens = 0; let outputTokens = 0
    controller.enqueue(event('message_start', { message: { id: messageId, type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 0, output_tokens: 0 } } }))
    try {
      for await (const item of events) {
        if (item.type === 'text_delta') {
          if (textIndex === undefined) { textIndex = nextBlockIndex++; startedIndexes.add(textIndex); controller.enqueue(event('content_block_start', { index: textIndex, content_block: { type: 'text', text: '' } })) }
          controller.enqueue(event('content_block_delta', { index: textIndex, delta: { type: 'text_delta', text: item.text } }))
        } else if (item.type === 'tool_start') { const index = nextBlockIndex++; toolIndexes.set(item.id, index); startedIndexes.add(index); controller.enqueue(event('content_block_start', { index, content_block: { type: 'tool_use', id: item.id, name: item.name, input: {} } })) }
        else if (item.type === 'tool_delta') controller.enqueue(event('content_block_delta', { index: toolIndexes.get(item.id) ?? textIndex ?? 0, delta: { type: 'input_json_delta', partial_json: item.argumentsDelta } }))
        else if (item.type === 'usage') { inputTokens = item.inputTokens || inputTokens; outputTokens = item.outputTokens || outputTokens; controller.enqueue(event('message_delta', { delta: { stop_reason: null, stop_sequence: null }, usage: { output_tokens: outputTokens } })) }
        else if (item.type === 'error') controller.enqueue(event('error', { error: { type: item.kind, message: item.message } }))
        else if (item.type === 'complete') { controller.enqueue(event('message_delta', { delta: { stop_reason: item.stopReason === 'tool_use' || toolIndexes.size ? 'tool_use' : item.stopReason || 'end_turn', stop_sequence: null }, usage: { input_tokens: inputTokens, output_tokens: outputTokens } })); for (const index of startedIndexes) controller.enqueue(event('content_block_stop', { index })); controller.enqueue(event('message_stop', {})) }
      }
      controller.close()
    } catch (error) { controller.enqueue(event('error', { error: { type: 'gateway_error', message: error instanceof Error ? error.message : 'stream failed' } })); controller.close() }
  } })
}
