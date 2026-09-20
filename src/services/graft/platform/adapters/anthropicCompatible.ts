import type { ProviderAdapter, NormalizedProviderStreamEvent } from '../types.js'
import type { NormalizedModelRequest } from '../types.js'
const endpoint = (base: string) => `${base.replace(/\/+$/, '')}${base.replace(/\/+$/, '').endsWith('/v1') ? '' : '/v1'}/messages`
async function upstreamErrorMessage(response: Response): Promise<string> {
  const raw = await response.text()
  try {
    const body = JSON.parse(raw)
    return String(body?.error?.message || body?.message || body?.title || raw)
  } catch {
    return raw || `Upstream request failed (${response.status})`
  }
}
function retryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}
async function* events(response: Response): AsyncIterable<NormalizedProviderStreamEvent> {
  if (!response.ok) { yield { type: 'error', kind: 'upstream_http', message: await upstreamErrorMessage(response), retryable: retryableStatus(response.status) }; return }
  if (!response.body) { yield { type: 'complete' }; return }
  let terminal = false
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buf = ''; const tools = new Map<number, string>(); let stopReason: string | undefined
  for (;;) { const next = await reader.read(); if (next.done) break; buf += decoder.decode(next.value, { stream: true }); const lines = buf.split(/\r?\n/); buf = lines.pop() || ''
    for (const line of lines) if (line.startsWith('data:')) try {
      const e = JSON.parse(line.slice(5).trim())
      if (e.type === 'message_start' && e.message?.usage?.input_tokens) yield { type: 'usage', inputTokens: e.message.usage.input_tokens }
      else if (e.type === 'content_block_start' && e.content_block?.type === 'tool_use') { tools.set(e.index, e.content_block.id); yield { type: 'tool_start', id: e.content_block.id, name: e.content_block.name || '' } }
      else if (e.type === 'content_block_delta' && e.delta?.type === 'text_delta' && e.delta.text) yield { type: 'text_delta', text: e.delta.text }
      else if (e.type === 'content_block_delta' && e.delta?.type === 'input_json_delta' && e.delta.partial_json) { const id = tools.get(e.index); if (id) yield { type: 'tool_delta', id, argumentsDelta: e.delta.partial_json } }
      else if (e.type === 'message_delta' && e.usage) yield { type: 'usage', outputTokens: e.usage.output_tokens }
      else if (e.type === 'message_delta' && e.delta?.stop_reason) stopReason = e.delta.stop_reason
      else if (e.type === 'error') { terminal = true; yield { type: 'error', kind: e.error?.type || 'upstream_error', message: e.error?.message || 'Anthropic upstream error', retryable: false } }
      else if (e.type === 'message_stop') { terminal = true; yield { type: 'complete', stopReason } }
    } catch {}
  }
  if (!terminal) yield { type: 'complete', stopReason }
}

export function serializeAnthropicMessages(request: NormalizedModelRequest): { system?: string; messages: Array<Record<string, unknown>> } {
  const system = request.messages.filter(message => message.role === 'system').flatMap(message => message.content).flatMap(part => part.type === 'text' ? [part.text] : []).join('\n')
  const messages = request.messages.filter(message => message.role !== 'system').map(message => {
    const content = message.content.flatMap(
      (part): Array<Record<string, unknown>> => {
      if (part.type === 'text') return [{ type: 'text', text: part.text }]
      if (part.type === 'image') {
        if (part.data) return [{ type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.data } }]
        if (part.url) return [{ type: 'image', source: { type: 'url', url: part.url } }]
      }
      if (part.type === 'tool_call') return [{ type: 'tool_use', id: part.id, name: part.name, input: part.arguments }]
      if (part.type === 'tool_result') return [{ type: 'tool_result', tool_use_id: part.toolCallId, content: part.content, is_error: part.isError === true }]
        return []
      },
    )
    return { role: message.role === 'tool' ? 'user' : message.role, content }
  })
  return { system: system || undefined, messages }
}

export const anthropicCompatibleAdapter: ProviderAdapter = { protocol: 'anthropic', async *stream(selection, request, signal) {
  const serialized = serializeAnthropicMessages(request)
  const body = { model: request.model, max_tokens: request.maxOutputTokens || 4096, system: serialized.system, messages: serialized.messages, tools: request.tools?.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema })), tool_choice: request.toolChoice?.type === 'tool' ? { type: 'tool', name: request.toolChoice.name } : request.toolChoice?.type === 'required' ? { type: 'any' } : request.toolChoice?.type, stream: true, temperature: request.temperature, top_p: request.topP, stop_sequences: request.stop }
  const auth: Record<string, string> =
    selection.authMode === 'authToken'
      ? { Authorization: `Bearer ${selection.apiKey}` }
      : { 'x-api-key': selection.apiKey }
  yield* events(await fetch(endpoint(selection.baseUrl), { method: 'POST', headers: { ...auth, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body), signal }))
} }
