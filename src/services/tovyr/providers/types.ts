import type { ProviderErrorKind } from '../providerErrors.js'
import type { ModelReadinessState } from '../modelReadiness.js'

export type ProviderConnectionState =
  | 'unconfigured'
  | 'checking'
  | 'ready'
  | 'limited'
  | 'degraded'
  | 'invalid'
  | 'offline'

export type ModelLifecycle = 'active' | 'preview' | 'deprecated' | 'retired' | 'unknown'
export type ModelMetadataSource = 'provider' | 'signed-registry' | 'catalog' | 'inferred'

export type ModelDescriptor = {
  id: string
  displayName: string
  available: boolean
  contextTokens: number | null
  maxOutputTokens: number | null
  supportsTools: boolean | null
  supportsVision: boolean | null
  supportsReasoning: boolean | null
  supportsStreaming: boolean | null
  lifecycle: ModelLifecycle
  source: ModelMetadataSource
  /** USD per million tokens, when the provider quotes a price. */
  pricing?: { promptPerM: number; completionPerM: number } | null
  /** Input modalities the provider reports: text, image, audio, video. */
  modalities?: readonly string[]
  /** Display chips for the picker: FREE, $3.0/M, TOOLS, 1M ctx, 32k out, IMAGE. */
  tags?: string[]
}

export type ProviderQuotaSnapshot = {
  limited: boolean
  resetsAt?: number
  remaining?: number
  limit?: number
}

export type ProviderConnectionSnapshot = {
  state: ProviderConnectionState
  providerId: string
  providerLabel: string
  modelId: string
  checkedAt?: number
  latencyMs?: number
  supportsStreaming?: boolean
  supportsTools?: boolean | null
  modelState?: ModelReadinessState
  quota?: ProviderQuotaSnapshot
  errorKind?: ProviderErrorKind
  detail?: string
}

export type NormalizedProviderStreamEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'reasoning_summary_delta'; text: string }
  | { type: 'tool_start'; id: string; name: string }
  | { type: 'tool_delta'; id: string; argumentsDelta: string }
  | { type: 'tool_result'; id: string; result: unknown; isError?: boolean }
  | { type: 'usage'; inputTokens?: number; outputTokens?: number }
  | { type: 'quota'; quota: ProviderQuotaSnapshot }
  | { type: 'error'; kind: ProviderErrorKind; message: string }
  | { type: 'complete'; stopReason?: string }

export type ProviderAuthRequest =
  | { mode: 'apiKey'; apiKey: string }
  | { mode: 'oauth' }

export type ProviderProbeOptions = {
  signal: AbortSignal
  maxOutputTokens: number
}

/**
 * Provider boundary used by Tovyr-owned orchestration. Existing transports can
 * implement this incrementally without exposing provider-specific event types
 * to chat, health, model-picker, or quota UI code.
 */
export interface ProviderAdapter {
  readonly id: string
  authenticate(request: ProviderAuthRequest): Promise<void>
  listModels(signal?: AbortSignal): Promise<ModelDescriptor[]>
  probeModel(options: ProviderProbeOptions): Promise<ProviderConnectionSnapshot>
  streamChat(
    request: unknown,
    signal: AbortSignal,
  ): AsyncIterable<NormalizedProviderStreamEvent>
  normalizeError(error: unknown): {
    kind: ProviderErrorKind
    message: string
    retryable: boolean
  }
  readQuota(headers: Headers): ProviderQuotaSnapshot | undefined
}
