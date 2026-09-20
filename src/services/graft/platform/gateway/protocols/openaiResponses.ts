import { randomUUID } from 'node:crypto'
import { assertNormalizedRequest, type NormalizedModelRequest, type NormalizedProviderStreamEvent } from '../../types.js'
import { buildNormalizedRequest, normalizeContent, normalizeMessage } from './normalize.js'

export function decodeOpenAiResponsesRequest(value: unknown): NormalizedModelRequest {
  const body = (value && typeof value === 'object' ? value : {}) as Record<string, any>
  const input = typeof body.input === 'string' ? [{ role: 'user', content: body.input }] : Array.isArray(body.input) ? body.input : []
  const messages = input.flatMap((item: unknown) => {
    const value = item && typeof item === 'object' ? item as Record<string, any> : {}
    if (value.type === 'function_call_output') return [normalizeMessage({ role: 'tool', content: [{ type: 'tool_result', tool_use_id: value.call_id, content: typeof value.output === 'string' ? value.output : JSON.stringify(value.output ?? '') }] })]
    if (value.type === 'message') return [normalizeMessage({ role: value.role, content: value.content })]
    return [normalizeMessage(value)]
  })
  return assertNormalizedRequest(buildNormalizedRequest(body, messages))
}

function materialize(events: NormalizedProviderStreamEvent[]) { let text = ''; const calls: Array<{ id: string; name: string; args: string }> = []; let usage; let stop = 'completed'; for (const item of events) { if (item.type === 'text_delta') text += item.text; else if (item.type === 'tool_start') calls.push({ id: item.id, name: item.name, args: '' }); else if (item.type === 'tool_delta') { const call = calls.find(value => value.id === item.id); if (call) call.args += item.argumentsDelta } else if (item.type === 'usage') usage = { input_tokens: item.inputTokens || 0, output_tokens: item.outputTokens || 0, total_tokens: (item.inputTokens || 0) + (item.outputTokens || 0) }; else if (item.type === 'complete') stop = item.stopReason || stop } return { text, calls, usage, stop } }

export function encodeOpenAiResponsesJson(model: string, events: NormalizedProviderStreamEvent[]): Record<string, unknown> {
  const output = materialize(events); const content: Record<string, unknown>[] = output.text ? [{ type: 'output_text', text: output.text, annotations: [] }] : []; const responseOutput: Record<string, unknown>[] = output.text ? [{ type: 'message', id: `msg_${randomUUID()}`, status: 'completed', role: 'assistant', content }] : []
  for (const call of output.calls) responseOutput.push({ type: 'function_call', id: call.id, call_id: call.id, name: call.name, arguments: call.args, status: 'completed' })
  return { id: `resp_${randomUUID()}`, object: 'response', created_at: Math.floor(Date.now() / 1000), status: 'completed', model, output: responseOutput, output_text: output.text, usage: output.usage || { input_tokens: 0, output_tokens: 0, total_tokens: 0 } }
}

function frame(value: unknown): Uint8Array { return new TextEncoder().encode(`data: ${JSON.stringify(value)}\n\n`) }
export function encodeOpenAiResponsesStream(model: string, events: AsyncIterable<NormalizedProviderStreamEvent>): ReadableStream<Uint8Array> {
  return new ReadableStream({ async start(controller) {
    const id = `resp_${randomUUID()}`; const messageId = `msg_${randomUUID()}`; let inputTokens = 0; let outputTokens = 0; let text = ''; let messageStarted = false; let failed = false
    const startMessage = () => {
      if (messageStarted) return
      messageStarted = true
      controller.enqueue(frame({ type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: messageId, status: 'in_progress', role: 'assistant', content: [] } }))
      controller.enqueue(frame({ type: 'response.content_part.added', item_id: messageId, output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } }))
    }
    const completedMessage = () => ({ type: 'message', id: messageId, status: 'completed', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] })
    controller.enqueue(frame({ type: 'response.created', response: { id, object: 'response', status: 'in_progress', model, output: [] } }))
    try {
      for await (const item of events) {
        if (item.type === 'text_delta') { startMessage(); text += item.text; controller.enqueue(frame({ type: 'response.output_text.delta', item_id: messageId, output_index: 0, content_index: 0, delta: item.text })) }
        else if (item.type === 'tool_start') controller.enqueue(frame({ type: 'response.output_item.added', output_index: 0, item: { type: 'function_call', id: item.id, call_id: item.id, name: item.name, arguments: '' } }))
        else if (item.type === 'tool_delta') controller.enqueue(frame({ type: 'response.function_call_arguments.delta', item_id: item.id, output_index: 0, delta: item.argumentsDelta }))
        else if (item.type === 'usage') {
          // Usage is attached to the terminal response.completed event; do not
          // emit an early completion frame while the provider is still streaming.
          inputTokens = item.inputTokens || inputTokens; outputTokens = item.outputTokens || outputTokens
        }
        else if (item.type === 'error') {
          failed = true
          const response = { id, object: 'response', status: 'failed', model, output: [], error: { code: item.kind, message: item.message } }
          controller.enqueue(frame({ type: 'response.failed', response }))
          // Codex 0.144 and other older Responses clients only finalize their
          // request state on response.completed, even when status is failed.
          controller.enqueue(frame({ type: 'response.completed', response }))
          break
        }
        else if (item.type === 'complete') {
          if (messageStarted) {
            const part = { type: 'output_text', text, annotations: [] }
            controller.enqueue(frame({ type: 'response.output_text.done', item_id: messageId, output_index: 0, content_index: 0, text }))
            controller.enqueue(frame({ type: 'response.content_part.done', item_id: messageId, output_index: 0, content_index: 0, part }))
            controller.enqueue(frame({ type: 'response.output_item.done', output_index: 0, item: completedMessage() }))
          }
          controller.enqueue(frame({ type: 'response.completed', response: { id, object: 'response', status: 'completed', model, output: messageStarted ? [completedMessage()] : [], usage: { input_tokens: inputTokens, output_tokens: outputTokens, total_tokens: inputTokens + outputTokens } } }))
        }
      }
      controller.close()
    } catch (error) {
      const response = { id, object: 'response', status: 'failed', model, output: [], error: { code: 'gateway_error', message: error instanceof Error ? error.message : 'stream failed' } }
      controller.enqueue(frame({ type: 'response.failed', response }))
      controller.enqueue(frame({ type: 'response.completed', response }))
      controller.close()
    }
  } })
}
