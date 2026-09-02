import type { NormalizedContentPart, NormalizedMessage, NormalizedModelRequest, NormalizedTool, NormalizedToolChoice } from '../../types.js'

const record = (value: unknown): Record<string, any> => (value && typeof value === 'object' ? value as Record<string, any> : {})

function parseArguments(value: unknown): unknown {
  if (typeof value !== 'string') return value || {}
  try { return JSON.parse(value) } catch { return value }
}

export function normalizeContent(content: unknown, fallbackToolCallId?: string): NormalizedContentPart[] {
  if (typeof content === 'string') return [{ type: 'text', text: content }]
  if (!Array.isArray(content)) return []
  return content.flatMap((raw): NormalizedContentPart[] => {
    const part = record(raw)
    if (part.type === 'text' || part.type === 'input_text' || part.type === 'output_text') return [{ type: 'text', text: String(part.text || '') }]
    if (part.type === 'image_url') {
      const image = record(part.image_url)
      return [{ type: 'image', url: String(image.url || ''), mediaType: String(image.media_type || 'image/*') }]
    }
    if (part.type === 'image') {
      const source = record(part.source)
      if (source.type === 'base64') return [{ type: 'image', data: String(source.data || ''), mediaType: String(source.media_type || 'image/*') }]
      return [{ type: 'image', url: String(source.url || part.url || ''), mediaType: String(source.media_type || part.mediaType || 'image/*') }]
    }
    if (part.type === 'tool_use' || part.type === 'function_call') return [{ type: 'tool_call', id: String(part.id || part.call_id || fallbackToolCallId || ''), name: String(part.name || record(part.function).name || ''), arguments: parseArguments(part.input ?? part.arguments ?? record(part.function).arguments) }]
    if (part.type === 'tool_result' || part.type === 'function_call_output') {
      const result: NormalizedContentPart = { type: 'tool_result', toolCallId: String(part.tool_use_id || part.call_id || fallbackToolCallId || ''), content: typeof part.content === 'string' ? part.content : typeof part.output === 'string' ? part.output : JSON.stringify(part.content ?? part.output ?? '') }
      if (part.is_error === true) result.isError = true
      return [result]
    }
    return []
  })
}

export function normalizeMessage(raw: unknown): NormalizedMessage {
  const message = record(raw)
  const role = message.role === 'system' || message.role === 'assistant' || message.role === 'tool' ? message.role : 'user'
  const parts = normalizeContent(message.content, message.tool_call_id)
  const calls = Array.isArray(message.tool_calls) ? message.tool_calls.flatMap((call: unknown): NormalizedContentPart[] => {
    const value = record(call); const fn = record(value.function)
    return [{ type: 'tool_call', id: String(value.id || ''), name: String(fn.name || value.name || ''), arguments: parseArguments(fn.arguments ?? value.arguments) }]
  }) : []
  return { role, content: [...parts, ...calls] }
}

export function normalizeTools(raw: unknown): NormalizedTool[] | undefined {
  if (!Array.isArray(raw)) return undefined
  return raw.flatMap((item: unknown) => {
    const value = record(item); const fn = record(value.function)
    const name = String(value.name || fn.name || '')
    if (!name) return []
    return [{ name, description: value.description || fn.description, inputSchema: (value.input_schema || value.parameters || fn.parameters || { type: 'object', properties: {} }) as Record<string, unknown> }]
  })
}

export function normalizeToolChoice(raw: unknown): NormalizedToolChoice | undefined {
  if (raw === undefined || raw === null) return undefined
  if (raw === 'none') return { type: 'none' }
  if (raw === 'required' || raw === 'any') return { type: 'required' }
  if (raw === 'auto') return { type: 'auto' }
  const value = record(raw); const fn = record(value.function)
  const name = value.name || fn.name
  if (value.type === 'tool' || value.type === 'function') return name ? { type: 'tool', name: String(name) } : { type: 'required' }
  return undefined
}

export function buildNormalizedRequest(body: Record<string, any>, messages: NormalizedMessage[]): NormalizedModelRequest {
  const reasoning = record(body.reasoning)
  const effort = body.reasoning_effort || reasoning.effort || body.effort
  const validEfforts = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'])
  return {
    model: String(body.model || '').trim(),
    messages,
    tools: normalizeTools(body.tools),
    toolChoice: normalizeToolChoice(body.tool_choice ?? body.toolChoice),
    maxOutputTokens: Number.isFinite(body.max_output_tokens) ? body.max_output_tokens : Number.isFinite(body.max_tokens) ? body.max_tokens : undefined,
    temperature: typeof body.temperature === 'number' ? body.temperature : undefined,
    topP: typeof body.top_p === 'number' ? body.top_p : undefined,
    stop: Array.isArray(body.stop) ? body.stop.filter((item: unknown): item is string => typeof item === 'string') : Array.isArray(body.stop_sequences) ? body.stop_sequences.filter((item: unknown): item is string => typeof item === 'string') : undefined,
    effort: typeof effort === 'string' && validEfforts.has(effort) ? effort as NormalizedModelRequest['effort'] : undefined,
    // OpenAI, Anthropic, and Responses default to a JSON response when the
    // stream flag is omitted. Callers that want SSE/NDJSON opt in explicitly.
    stream: body.stream === true,
  }
}
