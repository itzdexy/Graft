import type { ProviderAdapter, ResolvedProviderSelection, NormalizedModelRequest, NormalizedProviderStreamEvent } from '../types.js'

const urlFor = (base: string) => `${base.replace(/\/+$/, '')}${base.replace(/\/+$/, '').endsWith('/v1') ? '' : '/v1'}/chat/completions`
function headers(selection: ResolvedProviderSelection): Record<string, string> {
  return { 'content-type': 'application/json', Authorization: `Bearer ${selection.apiKey}` }
}
async function* parse(response: Response): AsyncIterable<NormalizedProviderStreamEvent> {
  if (!response.ok) { yield { type: 'error', kind: 'upstream_http', message: await response.text(), retryable: response.status >= 500 }; return }
  if (!response.body) { yield { type: 'complete' }; return }
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
  for (;;) {
    const part = await reader.read(); if (part.done) break
    buffer += decoder.decode(part.value, { stream: true })
    const lines = buffer.split(/\r?\n/); buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim(); if (raw === '[DONE]') { yield { type: 'complete' }; continue }
      try {
        const json = JSON.parse(raw); const choice = json.choices?.[0]; const delta = choice?.delta
        if (delta?.content) yield { type: 'text_delta', text: delta.content }
        if (delta?.reasoning_content) yield { type: 'reasoning_delta', text: delta.reasoning_content }
        for (const call of delta?.tool_calls || []) {
          if (call.function?.name) yield { type: 'tool_start', id: call.id || `tool_${call.index}`, name: call.function.name }
          if (call.function?.arguments) yield { type: 'tool_delta', id: call.id || `tool_${call.index}`, argumentsDelta: call.function.arguments }
        }
        if (json.usage) yield { type: 'usage', inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }
        if (choice?.finish_reason) yield { type: 'complete', stopReason: choice.finish_reason }
      } catch { /* ignore malformed keepalive */ }
    }
  }
}
export const openAiCompatibleAdapter: ProviderAdapter = {
  protocol: 'openai',
  async *stream(selection, request, signal) {
    const body = { model: request.model, messages: request.messages, tools: request.tools?.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })), stream: true, max_tokens: request.maxOutputTokens, temperature: request.temperature, top_p: request.topP, stop: request.stop }
    yield* parse(await fetch(urlFor(selection.baseUrl), { method: 'POST', headers: headers(selection), body: JSON.stringify(body), signal }))
  },
}
