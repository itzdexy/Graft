export type NormalizedContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; data?: string; url?: string }
  | { type: 'tool_call'; id: string; name: string; arguments: unknown }
  | { type: 'tool_result'; toolCallId: string; content: string; isError?: boolean }

export type NormalizedMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: NormalizedContentPart[] }
export type NormalizedTool = { name: string; description?: string; inputSchema: Record<string, unknown> }
export type NormalizedToolChoice = { type: 'auto' | 'none' | 'required' } | { type: 'tool'; name: string }
export type NormalizedModelRequest = {
  model: string; messages: NormalizedMessage[]; tools?: NormalizedTool[]; toolChoice?: NormalizedToolChoice
  maxOutputTokens?: number; temperature?: number; topP?: number; stop?: string[]
  effort?: 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'ultra'; stream: boolean
}
export type NormalizedProviderStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'reasoning_delta'; text: string }
  | { type: 'reasoning_summary_delta'; text: string }
  | { type: 'tool_start'; id: string; name: string } | { type: 'tool_delta'; id: string; argumentsDelta: string }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number }
  | { type: 'error'; kind: string; message: string; retryable: boolean } | { type: 'complete'; stopReason?: string }
export type ResolvedProviderSelection = {
  providerId: string; providerLabel: string; modelId: string; baseUrl: string; apiKey: string
  authMode: 'apiKey' | 'authToken' | 'oauth'; protocol: 'openai' | 'anthropic'
}
export interface ProviderAdapter {
  readonly protocol: 'openai' | 'anthropic'
  stream(selection: ResolvedProviderSelection, request: NormalizedModelRequest, signal: AbortSignal): AsyncIterable<NormalizedProviderStreamEvent>
}

export class PlatformRequestError extends Error {
  readonly code = 'invalid_request'
  constructor(message: string) { super(message); this.name = 'PlatformRequestError' }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
export function assertNormalizedRequest(value: unknown): NormalizedModelRequest {
  if (!isRecord(value)) throw new PlatformRequestError('Request must be an object')
  const model = typeof value.model === 'string' ? value.model.trim() : ''
  const messages = value.messages
  if (!model) throw new PlatformRequestError('model is required')
  if (!Array.isArray(messages) || messages.length === 0) throw new PlatformRequestError('at least one message is required')
  if (messages.length > 256) throw new PlatformRequestError('at most 256 messages are allowed')
  if (messages.some((m) => !isRecord(m) || !['system', 'user', 'assistant', 'tool'].includes(String(m.role)) || !Array.isArray(m.content))) {
    throw new PlatformRequestError('messages must contain valid role and content')
  }
  const tools = value.tools
  if (tools !== undefined && (!Array.isArray(tools) || tools.length > 128 || tools.some((t) => !isRecord(t) || typeof t.name !== 'string' || !isRecord(t.inputSchema)))) {
    throw new PlatformRequestError('tools must contain at most 128 valid tools')
  }
  const normalized = { ...value, model, messages, tools, stream: value.stream === true } as NormalizedModelRequest
  let serializedSize = 0
  try { serializedSize = new TextEncoder().encode(JSON.stringify(normalized)).byteLength } catch { throw new PlatformRequestError('request is not serializable') }
  if (serializedSize > 64 * 1024 * 1024) throw new PlatformRequestError('request exceeds 64 MiB input limit')
  return normalized
}
