import type { ProviderAdapter, NormalizedProviderStreamEvent } from '../types.js'
const endpoint = (base: string) => `${base.replace(/\/+$/, '')}${base.replace(/\/+$/, '').endsWith('/v1') ? '' : '/v1'}/messages`
async function* events(response: Response): AsyncIterable<NormalizedProviderStreamEvent> {
  if (!response.ok) { yield { type: 'error', kind: 'upstream_http', message: await response.text(), retryable: response.status >= 500 }; return }
  if (!response.body) return
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buf = ''
  for (;;) { const next = await reader.read(); if (next.done) break; buf += decoder.decode(next.value, { stream: true }); const lines = buf.split(/\r?\n/); buf = lines.pop() || ''
    for (const line of lines) if (line.startsWith('data:')) try { const e = JSON.parse(line.slice(5).trim()); if (e.type === 'content_block_delta' && e.delta?.text) yield { type: 'text_delta', text: e.delta.text }; else if (e.type === 'message_delta' && e.usage) yield { type: 'usage', outputTokens: e.usage.output_tokens }; else if (e.type === 'message_stop') yield { type: 'complete' } } catch {}
  }
}
export const anthropicCompatibleAdapter: ProviderAdapter = { protocol: 'anthropic', async *stream(selection, request, signal) {
  const system = request.messages.filter(m => m.role === 'system').flatMap(m => m.content).map(p => p.type === 'text' ? p.text : '').join('\n')
  const messages = request.messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.content.map(p => p.type === 'text' ? { type: 'text', text: p.text } : p) }))
  const body = { model: request.model, max_tokens: request.maxOutputTokens || 4096, system: system || undefined, messages, tools: request.tools?.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema })), stream: true, temperature: request.temperature, top_p: request.topP, stop_sequences: request.stop }
  const auth = selection.authMode === 'authToken' ? { Authorization: `Bearer ${selection.apiKey}` } : { 'x-api-key': selection.apiKey }
  yield* events(await fetch(endpoint(selection.baseUrl), { method: 'POST', headers: { ...auth, 'content-type': 'application/json', 'anthropic-version': '2023-06-01' }, body: JSON.stringify(body), signal }))
} }
