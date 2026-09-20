import type { ProviderAdapter, ResolvedProviderSelection, NormalizedModelRequest, NormalizedProviderStreamEvent } from '../types.js'

type OpenAiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

const urlFor = (base: string) => `${base.replace(/\/+$/, '')}${base.replace(/\/+$/, '').endsWith('/v1') ? '' : '/v1'}/chat/completions`
function headers(selection: ResolvedProviderSelection): Record<string, string> {
  return { 'content-type': 'application/json', Authorization: `Bearer ${selection.apiKey}` }
}

async function upstreamErrorMessage(response: Response): Promise<string> {
  const raw = await response.text()
  try {
    const body = JSON.parse(raw)
    return String(body?.error?.message || body?.error?.error?.message || body?.message || body?.title || raw)
  } catch {
    return raw || `Upstream request failed (${response.status})`
  }
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}

export function serializeOpenAiMessages(request: NormalizedModelRequest): Array<Record<string, unknown>> {
  return request.messages.map(message => {
    const toolCalls = message.content.filter(part => part.type === 'tool_call')
    const toolResults = message.content.filter(part => part.type === 'tool_result')
    if (message.role === 'tool') {
      const result = toolResults[0]
      return { role: 'tool', tool_call_id: result?.type === 'tool_result' ? result.toolCallId : '', content: result?.type === 'tool_result' ? result.content : '' }
    }
    const contentParts = message.content.flatMap(
      (part): OpenAiContentPart[] => {
      if (part.type === 'text') return [{ type: 'text', text: part.text }]
      if (part.type === 'image') {
        const url = part.url || (part.data ? `data:${part.mediaType};base64,${part.data}` : '')
        return url ? [{ type: 'image_url', image_url: { url } }] : []
      }
        return []
      },
    )
    const firstPart = contentParts[0]
    const content =
      contentParts.length === 0
        ? null
        : contentParts.length === 1 && firstPart?.type === 'text'
          ? firstPart.text
          : contentParts
    const output: Record<string, unknown> = { role: message.role, content }
    if (toolCalls.length) output.tool_calls = toolCalls.map(part => part.type === 'tool_call' ? ({ id: part.id, type: 'function', function: { name: part.name, arguments: typeof part.arguments === 'string' ? part.arguments : JSON.stringify(part.arguments) } }) : part)
    return output
  })
}

function requestBody(request: NormalizedModelRequest): Record<string, unknown> {
  return {
    model: request.model,
    messages: serializeOpenAiMessages(request),
    tools: request.tools?.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } })),
    tool_choice: request.toolChoice?.type === 'tool' ? { type: 'function', function: { name: request.toolChoice.name } } : request.toolChoice?.type,
    stream: true,
    max_tokens: request.maxOutputTokens,
    temperature: request.temperature,
    top_p: request.topP,
    stop: request.stop,
  }
}

async function* streamOnce(selection: ResolvedProviderSelection, request: NormalizedModelRequest, signal: AbortSignal): AsyncIterable<NormalizedProviderStreamEvent> {
  yield* parse(await fetch(urlFor(selection.baseUrl), { method: 'POST', headers: headers(selection), body: JSON.stringify(requestBody(request)), signal }))
}

async function* parse(response: Response): AsyncIterable<NormalizedProviderStreamEvent> {
  if (!response.ok) { yield { type: 'error', kind: 'upstream_http', message: await upstreamErrorMessage(response), retryable: retryableStatus(response.status) }; return }
  if (!response.body) { yield { type: 'complete', stopReason: 'stop' }; return }
  let terminal = false
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
  for (;;) {
    const part = await reader.read(); if (part.done) break
    buffer += decoder.decode(part.value, { stream: true })
    const lines = buffer.split(/\r?\n/); buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const raw = line.slice(5).trim(); if (raw === '[DONE]') { if (!terminal) { terminal = true; yield { type: 'complete', stopReason: 'stop' } }; continue }
      try {
        const json = JSON.parse(raw)
        if (json.error) { terminal = true; yield { type: 'error', kind: json.error.type || 'upstream_error', message: json.error.message || 'OpenAI upstream error', retryable: true }; continue }
        const choice = json.choices?.[0]; const delta = choice?.delta
        if (delta?.content) yield { type: 'text_delta', text: delta.content }
        if (delta?.reasoning_content) yield { type: 'reasoning_delta', text: delta.reasoning_content }
        for (const call of delta?.tool_calls || []) {
          if (call.function?.name) yield { type: 'tool_start', id: call.id || `tool_${call.index}`, name: call.function.name }
          if (call.function?.arguments) yield { type: 'tool_delta', id: call.id || `tool_${call.index}`, argumentsDelta: call.function.arguments }
        }
        if (json.usage) yield { type: 'usage', inputTokens: json.usage.prompt_tokens, outputTokens: json.usage.completion_tokens }
        if (choice?.finish_reason) { terminal = true; yield { type: 'complete', stopReason: choice.finish_reason } }
      } catch { /* ignore malformed keepalive */ }
    }
  }
  if (!terminal) yield { type: 'complete', stopReason: 'stop' }
}
export const openAiCompatibleAdapter: ProviderAdapter = {
  protocol: 'openai',
  async *stream(selection, request, signal) {
    let emittedOutput = false
    for await (const event of streamOnce(selection, request, signal)) {
      // Some OpenAI-compatible endpoints return HTTP 200 and then emit an
      // internal_server_error when they cannot validate Codex's tool schemas.
      // Retry once without tools before exposing that provider limitation.
      if (!emittedOutput && event.type === 'error' && event.kind === 'internal_server_error' && request.tools?.length) {
        yield* streamOnce(selection, { ...request, tools: undefined, toolChoice: undefined }, signal)
        return
      }
      if (event.type === 'text_delta' || event.type === 'reasoning_delta' || event.type === 'tool_start' || event.type === 'tool_delta') emittedOutput = true
      yield event
    }
  },
}
