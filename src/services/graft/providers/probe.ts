import {
  describeGraftContextWindow,
  getGraftMaxOutputLimitsForModel,
} from '../modelContext.js'
import { getCachedProviderModelDescriptors } from '../providerModels.js'
import { randomUUID } from 'node:crypto'
import { OAUTH_BETA_HEADER } from '../../../constants/oauth.js'
import {
  getProvider,
  resolveActive,
  resolveProviderSelection,
  setActiveModel,
} from '../../../../scripts/graft-providers.js'
import {
  openAiChatCompletionsUrl,
  openAiModelsUrl,
  providerNeedsOpenAiCompat,
} from '../../../../scripts/graft-provider-upstream.js'
import { getGraftWebOAuthTokensAsync } from '../../../utils/auth.js'
import { resolveModelCapabilities } from '../modelCapabilities.js'
import {
  classifyProviderError,
  type ProviderErrorKind,
} from '../providerErrors.js'
import { setProviderConnectionSnapshot } from './connectionStore.js'
import type {
  ProviderConnectionSnapshot,
  ProviderQuotaSnapshot,
} from './types.js'
import {
  clearProviderModelUnavailable,
  markProviderModelUnavailable,
  getProviderModelUnavailableReason,
} from '../modelAvailability.js'
import { pickBestProviderModel } from '../providerModelPick.js'
import {
  getCachedProviderModelIds,
  hasWarmProviderModelCache,
} from '../providerModels.js'
import {
  applyGraftActiveProviderToEnv,
} from '../applyProviderEnv.js'
import { syncGraftModelToSession } from '../syncModelState.js'
import { modelUsesOpenAiThinkingKwargs } from '../openAiModelSuitability.js'
import {
  setModelReadiness,
  type ModelReadinessState,
} from '../modelReadiness.js'
import {
  isMetaProviderId,
  metaProbeTreatsEmptyOutputAsSuccess,
  remapMetaThinkingConfig,
  shouldSkipMetaChatProbe,
} from '../metaProvider.js'

const PROBE_TIMEOUT_MS = 12_000
/**
 * Budget for a model the user just picked. Raised 8s → 15s → 30s: each bump
 * followed a report of a *working* model being rejected. A cold first token
 * from a large MoE or reasoning model (stealth/ox-alpha, a 1M-context
 * reasoning model, was the latest) routinely passes 15s.
 *
 * The asymmetry justifies the long wait: telling someone a good model is
 * broken costs them the model, while waiting is only time, and the picker
 * shows a spinner throughout. A timeout is still recoverable — it reports
 * "slow" rather than "broken", which the caller may accept via allowSlow.
 */
const PICKER_PROBE_TIMEOUT_MS = 30_000
const PROBE_CACHE_TTL_MS = 5 * 60 * 1000
/** Re-check sooner when the last probe looked unhealthy. */
const PROBE_DEGRADED_CACHE_TTL_MS = 45_000
const PROBE_MAX_OUTPUT_TOKENS = 16
const MAX_PROBE_STREAM_BYTES = 64 * 1024

type ActiveProvider = NonNullable<ReturnType<typeof resolveActive>>
type ProbeResult = {
  supportsStreaming: boolean
  text: string
  headers: Headers
}

export type ModelAvailabilityResult = {
  ok: boolean
  latencyMs: number
  readiness: ModelReadinessState
  detail?: string
}

export type ProbeOutcomeClassification = {
  providerState: 'reachable' | 'invalid_credentials' | 'limited' | 'offline'
  modelState: ModelReadinessState
  hardFailure: boolean
}

export function classifyProbeOutcome(input: {
  providerReachable: boolean
  timedOut?: boolean
  transientFailure?: boolean
  status?: number
}): ProbeOutcomeClassification {
  if (input.status === 401 || input.status === 403) {
    return {
      providerState: 'invalid_credentials',
      modelState: 'unknown',
      hardFailure: false,
    }
  }
  if (input.status === 429) {
    return {
      providerState: 'limited',
      modelState: 'unknown',
      hardFailure: false,
    }
  }
  if (input.status === 404) {
    return {
      providerState: input.providerReachable ? 'reachable' : 'offline',
      modelState: 'unavailable',
      hardFailure: true,
    }
  }
  if (input.timedOut || input.transientFailure) {
    return {
      providerState: input.providerReachable ? 'reachable' : 'offline',
      modelState: input.providerReachable ? 'slow' : 'unknown',
      hardFailure: false,
    }
  }
  return {
    providerState: input.providerReachable ? 'reachable' : 'offline',
    modelState: 'unknown',
    hardFailure: false,
  }
}

let cached: ProviderConnectionSnapshot | null = null
let inFlight:
  | {
      key: string
      promise: Promise<ProviderConnectionSnapshot>
    }
  | null = null
let probeGeneration = 0

function activeKey(active: ActiveProvider): string {
  return `${active.providerId}\0${active.model}\0${active.baseUrl}`
}

function safeDetail(value: string): string {
  return value
    .replace(/\b(?:sk|fe_oa|hf|AIza)[-_A-Za-z0-9]{8,}\b/g, '[credential]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [credential]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 320)
}

function probeFailureDetail(
  kind: ProviderErrorKind,
  providerLabel: string,
  baseUrl: string,
  message: string,
): string {
  if (kind === 'network_error') {
    return `${providerLabel}'s inference request failed at ${baseUrl}. Model-list availability does not confirm inference access. Retry or check your network and provider endpoint.`
  }
  return safeDetail(message)
}

function parseResetValue(value: string | null): number | undefined {
  if (!value) return undefined
  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return numeric > 1e12 ? numeric / 1000 : numeric
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed / 1000 : undefined
}

export function readProviderQuota(headers: Headers): ProviderQuotaSnapshot | undefined {
  const remainingRaw =
    headers.get('anthropic-ratelimit-unified-remaining') ??
    headers.get('x-ratelimit-remaining-requests')
  const limitRaw =
    headers.get('anthropic-ratelimit-unified-limit') ??
    headers.get('x-ratelimit-limit-requests')
  const resetRaw =
    headers.get('anthropic-ratelimit-unified-reset') ??
    headers.get('x-ratelimit-reset-requests') ??
    headers.get('retry-after')
  const status = headers.get('anthropic-ratelimit-unified-status')

  if (!remainingRaw && !limitRaw && !resetRaw && !status) return undefined
  const remaining = remainingRaw == null ? undefined : Number(remainingRaw)
  const limit = limitRaw == null ? undefined : Number(limitRaw)
  const resetsAt = parseResetValue(resetRaw)
  return {
    limited:
      status === 'rejected' ||
      (Number.isFinite(remaining) && remaining === 0),
    remaining: Number.isFinite(remaining) ? remaining : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
    resetsAt,
  }
}

function anthropicMessagesUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  if (base.endsWith('/messages')) return base
  if (base.endsWith('/v1')) return `${base}/messages`
  return `${base}/v1/messages`
}

async function authHeaders(active: ActiveProvider): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-request-id': randomUUID(),
  }
  if (active.authMode === 'oauth') {
    const tokens = await getGraftWebOAuthTokensAsync()
    if (!tokens?.accessToken) throw new Error('No Graft OAuth token is available.')
    headers.Authorization = `Bearer ${tokens.accessToken}`
    headers['anthropic-beta'] = OAUTH_BETA_HEADER
  } else if (active.authMode === 'authToken') {
    headers.Authorization = `Bearer ${active.apiKey}`
  } else {
    headers['x-api-key'] = active.apiKey
  }
  return headers
}

function extractAnthropicBlockText(block: unknown): string {
  if (!block || typeof block !== 'object') return ''
  const item = block as { text?: unknown; thinking?: unknown }
  if (typeof item.text === 'string' && item.text.trim()) return item.text
  if (typeof item.thinking === 'string' && item.thinking.trim()) {
    return item.thinking
  }
  return ''
}

export function extractProbePayloadText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const root = payload as Record<string, unknown>
  const choices = root.choices
  if (Array.isArray(choices)) {
    const first = choices[0] as Record<string, unknown> | undefined
    const message = first?.message as Record<string, unknown> | undefined
    const fromMessage = extractOpenAiAssistantText(message)
    if (fromMessage) return fromMessage
  }
  const content = root.content
  if (Array.isArray(content)) {
    return content.map(extractAnthropicBlockText).join('')
  }
  return typeof root.output_text === 'string' ? root.output_text : ''
}

/**
 * Prefer visible content; fall back to reasoning fields so GLM/DeepSeek-style
 * probes are not marked degraded while the model is only thinking.
 */
export function extractOpenAiAssistantText(
  message: Record<string, unknown> | undefined,
): string {
  if (!message) return ''
  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content
  }
  if (
    typeof message.reasoning_content === 'string' &&
    message.reasoning_content.trim()
  ) {
    return message.reasoning_content
  }
  if (typeof message.reasoning === 'string' && message.reasoning.trim()) {
    return message.reasoning
  }
  return typeof message.content === 'string' ? message.content : ''
}

export function extractOpenAiDeltaText(
  delta: Record<string, unknown> | undefined,
): string {
  if (!delta) return ''
  if (typeof delta.content === 'string' && delta.content) return delta.content
  if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
    return delta.reasoning_content
  }
  if (typeof delta.reasoning === 'string' && delta.reasoning) {
    return delta.reasoning
  }
  if (typeof delta.text === 'string' && delta.text) return delta.text
  return ''
}

function extractSseText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const root = payload as Record<string, unknown>
  const delta = root.delta as Record<string, unknown> | undefined
  if (typeof delta?.text === 'string' && delta.text) return delta.text
  if (typeof delta?.thinking === 'string' && delta.thinking) return delta.thinking
  const choices = root.choices
  if (Array.isArray(choices)) {
    const first = choices[0] as Record<string, unknown> | undefined
    const choiceDelta = first?.delta as Record<string, unknown> | undefined
    const fromDelta = extractOpenAiDeltaText(choiceDelta)
    if (fromDelta) return fromDelta
  }
  return ''
}

async function readProbeResponse(response: Response): Promise<ProbeResult> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('text/event-stream') || !response.body) {
    const payload = (await response.json().catch(() => null)) as unknown
    return {
      supportsStreaming: false,
      text: extractProbePayloadText(payload),
      headers: response.headers,
    }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffered = ''
  let bytes = 0
  try {
    while (bytes < MAX_PROBE_STREAM_BYTES) {
      const { value, done } = await reader.read()
      if (done) break
      bytes += value.byteLength
      buffered += decoder.decode(value, { stream: true })
      const lines = buffered.split(/\r?\n/)
      buffered = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data || data === '[DONE]') continue
        const payload = JSON.parse(data) as unknown
        const text = extractSseText(payload)
        if (text) {
          await reader.cancel()
          return {
            supportsStreaming: true,
            text,
            headers: response.headers,
          }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  return { supportsStreaming: true, text: '', headers: response.headers }
}

async function errorBody(response: Response): Promise<string> {
  const raw = await response.text().catch(() => '')
  if (!raw) return `HTTP ${response.status}`
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string } | string
      message?: string
    }
    if (typeof parsed.error === 'string') return parsed.error
    return parsed.error?.message || parsed.message || `HTTP ${response.status}`
  } catch {
    return raw.slice(0, 1_000)
  }
}

export async function fetchOpenAiProbe(
  active: ActiveProvider,
  signal: AbortSignal,
): Promise<Response> {
  const headers = await authHeaders(active)
  // OpenAI-compatible gateways differ on whether baseUrl already includes /v1.
  const bases = [
    active.baseUrl,
    active.baseUrl.endsWith('/v1') ? undefined : `${active.baseUrl.replace(/\/+$/, '')}/v1`,
  ].filter((value): value is string => Boolean(value))
  const urls = [
    ...new Set(
      bases.map(baseUrl => String(openAiChatCompletionsUrl(baseUrl))),
    ),
  ]
  let last: Response | null = null
  for (const url of urls) {
    const response = await fetch(url, {
      method: 'POST',
      redirect: 'error',
      headers: {
        ...headers,
        Authorization: `Bearer ${active.apiKey}`,
      },
      body: JSON.stringify({
        model: active.model,
        messages: [
          {
            role: 'user',
            content: 'Connection check. Reply with exactly OK.',
          },
        ],
        max_tokens: PROBE_MAX_OUTPUT_TOKENS,
        // Non-streaming probes finish with a full JSON body — more reliable on
        // NIM than waiting for the first SSE token within a tight timeout.
        stream: false,
        temperature: 0,
        // Keep probes snappy on GLM/R1 — default thinking would time out.
        ...(modelUsesOpenAiThinkingKwargs(active.model)
          ? { chat_template_kwargs: { enable_thinking: false } }
          : {}),
      }),
      signal,
    })
    last = response
    if (response.status !== 404 || url === urls.at(-1)) return response
    await response.body?.cancel()
  }
  return last!
}

async function fetchAnthropicProbe(
  active: ActiveProvider,
  signal: AbortSignal,
): Promise<Response> {
  const headers = await authHeaders(active)
  const maxTokens = isMetaProviderId(active.providerId)
    ? 1024
    : PROBE_MAX_OUTPUT_TOKENS
  const thinking = isMetaProviderId(active.providerId)
    ? remapMetaThinkingConfig({ type: 'disabled' })
    : undefined
  return fetch(anthropicMessagesUrl(active.baseUrl), {
    method: 'POST',
    headers: {
      ...headers,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: active.model,
      max_tokens: maxTokens,
      stream: true,
      messages: [
        {
          role: 'user',
          content: 'Connection check. Reply with exactly OK.',
        },
      ],
      ...(thinking ? { thinking } : {}),
    }),
    signal,
  })
}

async function runTransportProbe(
  active: ActiveProvider,
  signal: AbortSignal,
): Promise<ProbeResult> {
  if (active.providerId === 'openai' && active.authMode === 'oauth') {
    const { runCodexCliProvider } = await import('../codexCliProvider.js')
    const text = await runCodexCliProvider(
      {
        model: active.model,
        max_tokens: PROBE_MAX_OUTPUT_TOKENS,
        stream: false,
        messages: [
          {
            role: 'user',
            content: 'Connection check. Reply with exactly OK.',
          },
        ],
      },
      signal,
    )
    return { supportsStreaming: false, text, headers: new Headers() }
  }

  const provider = getProvider(active.providerId)
  const response = providerNeedsOpenAiCompat(provider)
    ? await fetchOpenAiProbe(active, signal)
    : await fetchAnthropicProbe(active, signal)
  if (!response.ok) {
    const message = await errorBody(response)
    const error = new Error(message) as Error & {
      status?: number
      headers?: Headers
    }
    error.status = response.status
    error.headers = response.headers
    throw error
  }
  return readProbeResponse(response)
}

async function probeResolvedProviderModel(
  active: ActiveProvider,
  modelId: string,
  timeoutMs: number,
): Promise<ModelAvailabilityResult> {
  const startedAt = Date.now()
  if (shouldSkipMetaChatProbe(active.providerId, modelId)) {
    clearProviderModelUnavailable(active.providerId, modelId)
    setModelReadiness({
      providerId: active.providerId,
      modelId,
      state: 'ready',
      source: 'catalog',
      checkedAt: Date.now(),
      latencyMs: 0,
      hardFailure: false,
    })
    return { ok: true, latencyMs: 0, readiness: 'ready' }
  }
  try {
    const result = await runTransportProbe(
      { ...active, model: modelId },
      AbortSignal.timeout(timeoutMs),
    )
    if (!result.text.trim()) {
      if (metaProbeTreatsEmptyOutputAsSuccess(active.providerId, modelId)) {
        clearProviderModelUnavailable(active.providerId, modelId)
        const latencyMs = Date.now() - startedAt
        setModelReadiness({
          providerId: active.providerId,
          modelId,
          state: 'ready',
          source: 'probe',
          checkedAt: Date.now(),
          latencyMs,
          supportsStreaming: result.supportsStreaming,
          hardFailure: false,
        })
        return { ok: true, latencyMs, readiness: 'ready' }
      }
      const detail = `${modelId} returned no output. Choose another model.`
      markProviderModelUnavailable(active.providerId, modelId, detail)
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        readiness: 'unavailable',
        detail,
      }
    }
    clearProviderModelUnavailable(active.providerId, modelId)
    const latencyMs = Date.now() - startedAt
    setModelReadiness({
      providerId: active.providerId,
      modelId,
      state: 'ready',
      source: 'probe',
      checkedAt: Date.now(),
      latencyMs,
      supportsStreaming: result.supportsStreaming,
      hardFailure: false,
    })
    return { ok: true, latencyMs, readiness: 'ready' }
  } catch (error) {
    const candidate = error as Error & { status?: number }
    const classified = classifyProviderError({
      status: candidate.status,
      message: candidate.message,
      errorName: candidate.name,
    })
    const providerLabel =
      getProvider(active.providerId)?.label ?? active.providerId
    const detail =
      classified.kind === 'timeout'
        ? `${modelId} did not respond within ${Math.round(timeoutMs / 1_000)}s. Try again or choose another model.`
        : candidate.status === 404 ||
            classified.kind === 'model_unavailable' ||
            classified.kind === 'invalid_model'
          ? `${modelId} is listed by ${providerLabel}, but its chat endpoint is unavailable.`
          : probeFailureDetail(
              classified.kind,
              providerLabel,
              active.baseUrl,
              classified.message,
            )
    const knownReachable = providerReachableFromProbeEvidence({
      errorKind: classified.kind,
      hasWarmInventory: hasWarmProviderModelCache(active.providerId),
      status: candidate.status,
    })
    const outcome = classifyProbeOutcome({
      providerReachable:
        knownReachable ||
        ((classified.kind === 'timeout' || classified.kind === 'network_error') &&
          (await openAiProviderIsReachable(active))),
      timedOut: classified.kind === 'timeout',
      transientFailure: classified.kind === 'network_error',
      status: candidate.status,
    })
    setModelReadiness(
      {
        providerId: active.providerId,
        modelId,
        state: outcome.modelState,
        source: 'probe',
        checkedAt: Date.now(),
        latencyMs: Date.now() - startedAt,
        detail,
        hardFailure: outcome.hardFailure,
      },
      outcome.hardFailure ? 30 * 60 * 1000 : 45_000,
    )
    // Only poison the unavailable cache for hard model failures — timeouts and
    // transient network errors should not hide a model for the TTL window.
    if (
      candidate.status === 404 ||
      classified.kind === 'model_unavailable' ||
      classified.kind === 'invalid_model'
    ) {
      markProviderModelUnavailable(active.providerId, modelId, detail)
    }
    return {
      ok: false,
      latencyMs: Date.now() - startedAt,
      readiness: outcome.modelState,
      detail,
    }
  }
}

/** Validate any configured provider/model pair without changing active state. */
export async function probeProviderModel(input: {
  providerId: string
  modelId: string
  timeoutMs?: number
}): Promise<ModelAvailabilityResult> {
  const active = resolveProviderSelection(input.providerId, input.modelId)
  if (!active) {
    return {
      ok: false,
      latencyMs: 0,
      readiness: 'unknown',
      detail: 'That provider is not configured.',
    }
  }
  return probeResolvedProviderModel(
    active,
    input.modelId,
    input.timeoutMs ?? PICKER_PROBE_TIMEOUT_MS,
  )
}

/** Validate a picker candidate without changing the saved active model. */
export async function probeActiveProviderModel(
  modelId: string,
  timeoutMs = PICKER_PROBE_TIMEOUT_MS,
): Promise<ModelAvailabilityResult> {
  const active = resolveActive()
  if (!active) {
    return {
      ok: false,
      latencyMs: 0,
      readiness: 'unknown',
      detail: 'No provider is connected.',
    }
  }
  return probeResolvedProviderModel(active, modelId, timeoutMs)
}

/**
 * Decides whether the provider itself answered, using evidence already on hand.
 *
 * Any HTTP status proves the endpoint responded, and a warm model inventory
 * means a successful call landed moments ago. Either lets the probe skip the
 * extra `/models` round-trip on its error path, which is the slowest step in
 * reporting a timed-out model.
 */
export function providerReachableFromProbeEvidence(input: {
  errorKind: ProviderErrorKind
  hasWarmInventory: boolean
  status?: number
}): boolean {
  if (input.status != null) return true
  return input.hasWarmInventory
}

export function stateForError(
  kind: ProviderErrorKind,
  providerReachable = false,
): ProviderConnectionSnapshot['state'] {
  // NIM/OpenAI-compat often times out on a cold chat probe while /v1/models
  // still works. That is "slow model", not a broken provider — don't paint the
  // whole header yellow as degraded.
  if (providerReachable && (kind === 'network_error' || kind === 'timeout')) {
    return 'ready'
  }
  switch (kind) {
    case 'auth_failed':
    case 'invalid_key':
    case 'missing_key':
      return 'invalid'
    case 'rate_limit':
    case 'quota_exceeded':
      return 'limited'
    case 'network_error':
    case 'timeout':
      return 'offline'
    default:
      return 'degraded'
  }
}

async function openAiProviderIsReachable(
  active: ActiveProvider,
): Promise<boolean> {
  const provider = getProvider(active.providerId)
  if (!providerNeedsOpenAiCompat(provider)) return false
  try {
    const response = await fetch(openAiModelsUrl(active.baseUrl), {
      headers: { Authorization: `Bearer ${active.apiKey}` },
      signal: AbortSignal.timeout(2_500),
    })
    await response.body?.cancel()
    return response.ok
  } catch {
    return false
  }
}

/**
 * A real model answer proves the selected provider/model is usable. Some
 * account transports expose a complete response to the health check even
 * though normal chat is streamed elsewhere. That is a capability detail, not
 * a degraded connection.
 */
export function stateForProbeResult(input: {
  text: string
  quota?: ProviderQuotaSnapshot
}): ProviderConnectionSnapshot['state'] {
  if (input.quota?.limited) return 'limited'
  return input.text.trim() ? 'ready' : 'degraded'
}

/**
 * When the active model is poisoned (degraded/empty probe), hot-switch to the
 * next suitable verified model so the session does not stay on a dead id.
 */
async function reconcileAwayFromUnavailableModel(
  active: ActiveProvider,
): Promise<void> {
  // Only auto-hop on OpenAI-compat inventories. On Anthropic, a flaky probe
  // was promoting Haiku → Opus and then hitting "credits required".
  const def = getProvider(active.providerId)
  if (!providerNeedsOpenAiCompat(def)) return
  if (!getProviderModelUnavailableReason(active.providerId, active.model)) {
    return
  }
  const next = pickBestProviderModel(
    active.providerId,
    getCachedProviderModelIds(),
    new Set([active.model]),
  )
  if (!next || next === active.model) return
  setActiveModel(next, active.providerId)
  applyGraftActiveProviderToEnv({
    providerId: active.providerId,
    baseUrl: active.baseUrl,
    apiKey: active.apiKey,
    model: next,
    authMode: active.authMode,
  })
  syncGraftModelToSession(next)
  resetActiveProviderProbeCache()
  scheduleActiveProviderProbe({ force: true })
}

async function performProbe(active: ActiveProvider): Promise<ProviderConnectionSnapshot> {
  const startedAt = Date.now()
  if (shouldSkipMetaChatProbe(active.providerId, active.model)) {
    const capabilities = resolveModelCapabilities(active.model, active.providerId)
    clearProviderModelUnavailable(active.providerId, active.model)
    setModelReadiness({
      providerId: active.providerId,
      modelId: active.model,
      state: 'ready',
      source: 'catalog',
      checkedAt: Date.now(),
      latencyMs: 0,
      supportsTools: capabilities.toolCalling,
      supportsStreaming: true,
      hardFailure: false,
    })
    return {
      state: 'ready',
      providerId: active.providerId,
      providerLabel: active.label,
      modelId: active.model,
      checkedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
      supportsStreaming: true,
      supportsTools: capabilities.toolCalling,
      modelState: 'ready',
    }
  }
  const timeout = AbortSignal.timeout(PROBE_TIMEOUT_MS)
  try {
    const result = await runTransportProbe(active, timeout)
    const quota = readProviderQuota(result.headers)
    const capabilities = resolveModelCapabilities(active.model, active.providerId)
    const text = result.text.trim()
    const emptyMetaOk = metaProbeTreatsEmptyOutputAsSuccess(
      active.providerId,
      active.model,
    )
    const state = emptyMetaOk
      ? stateForProbeResult({ text: text || 'ok', quota })
      : stateForProbeResult({ text, quota })
    if (state === 'degraded') {
      markProviderModelUnavailable(
        active.providerId,
        active.model,
        'Provider accepted the request but returned no model output.',
      )
      void reconcileAwayFromUnavailableModel(active).catch(() => {})
    } else if (text || emptyMetaOk) {
      clearProviderModelUnavailable(active.providerId, active.model)
    }
    const modelState: ModelReadinessState =
      text || emptyMetaOk ? 'ready' : 'unavailable'
    setModelReadiness({
      providerId: active.providerId,
      modelId: active.model,
      state: modelState,
      source: 'probe',
      checkedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
      supportsStreaming: result.supportsStreaming,
      supportsTools: capabilities.toolCalling,
      detail:
        modelState === 'unavailable'
          ? 'Provider accepted the request but returned no model output.'
          : undefined,
      hardFailure: modelState === 'unavailable',
    })
    return {
      state,
      providerId: active.providerId,
      providerLabel: active.label,
      modelId: active.model,
      checkedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
      supportsStreaming: result.supportsStreaming,
      supportsTools: capabilities.toolCalling,
      modelState,
      quota,
      detail:
        state === 'degraded'
          ? 'Provider accepted the request but returned no model output.'
          : undefined,
    }
  } catch (error) {
    const candidate = error as Error & { status?: number; headers?: Headers }
    const classified = classifyProviderError({
      status: candidate.status,
      message: candidate.message,
      errorName: candidate.name,
    })
    const providerReachable =
      providerReachableFromProbeEvidence({
        errorKind: classified.kind,
        hasWarmInventory: hasWarmProviderModelCache(active.providerId),
        status: candidate.status,
      }) ||
      ((classified.kind === 'timeout' || classified.kind === 'network_error') &&
        (await openAiProviderIsReachable(active)))
    const outcome = classifyProbeOutcome({
      providerReachable,
      timedOut: classified.kind === 'timeout',
      status: candidate.status,
    })
    setModelReadiness(
      {
        providerId: active.providerId,
        modelId: active.model,
        state: outcome.modelState,
        source: 'probe',
        checkedAt: Date.now(),
        latencyMs: Date.now() - startedAt,
        detail: safeDetail(classified.message),
        hardFailure: outcome.hardFailure,
      },
      outcome.hardFailure ? 30 * 60 * 1000 : 45_000,
    )
    const quota = candidate.headers
      ? readProviderQuota(candidate.headers)
      : undefined
    return {
      state: stateForError(classified.kind, providerReachable),
      providerId: active.providerId,
      providerLabel: active.label,
      modelId: active.model,
      checkedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
      modelState: outcome.modelState,
      quota:
        classified.kind === 'rate_limit' ||
        classified.kind === 'quota_exceeded'
          ? { ...(quota ?? {}), limited: true }
          : quota,
      errorKind: classified.kind,
      detail: providerReachable
        ? undefined
        : safeDetail(classified.message),
    }
  }
}

export async function probeActiveProviderConnection(
  options: { force?: boolean } = {},
): Promise<ProviderConnectionSnapshot> {
  const active = resolveActive()
  if (!active) {
    const unconfigured: ProviderConnectionSnapshot = {
      state: 'unconfigured',
      providerId: '',
      providerLabel: '',
      modelId: '',
      detail: 'Connect a provider with /provider.',
    }
    setProviderConnectionSnapshot(unconfigured)
    return unconfigured
  }

  const key = activeKey(active)
  const generation = probeGeneration
  const cacheTtlMs =
    cached?.state === 'degraded' ||
    cached?.state === 'offline' ||
    cached?.state === 'invalid'
      ? PROBE_DEGRADED_CACHE_TTL_MS
      : PROBE_CACHE_TTL_MS
  if (
    !options.force &&
    cached &&
    cached.providerId === active.providerId &&
    cached.modelId === active.model &&
    cached.checkedAt &&
    Date.now() - cached.checkedAt < cacheTtlMs
  ) {
    setProviderConnectionSnapshot(cached)
    return cached
  }
  if (inFlight?.key === key) return inFlight.promise

  setProviderConnectionSnapshot({
    state: 'checking',
    providerId: active.providerId,
    providerLabel: active.label,
    modelId: active.model,
  })
  const promise = performProbe(active).then(result => {
    const current = resolveActive()
    const isCurrent =
      generation === probeGeneration &&
      current != null &&
      activeKey(current) === key
    if (isCurrent) {
      cached = result
      setProviderConnectionSnapshot(result)
    }
    return result
  })
  inFlight = { key, promise }
  try {
    return await promise
  } finally {
    if (inFlight?.promise === promise) inFlight = null
  }
}

export function scheduleActiveProviderProbe(
  options: { force?: boolean } = {},
): void {
  void probeActiveProviderConnection(options).catch(() => {
    // performProbe converts transport failures into a safe snapshot. This is
    // only a final guard so startup/provider switching can never crash the UI.
  })
}

export function resetActiveProviderProbeCache(): void {
  probeGeneration += 1
  cached = null
  inFlight = null
}

export function formatProviderConnectionSnapshot(
  snapshot: ProviderConnectionSnapshot,
): string {
  const title = snapshot.providerLabel
    ? `${snapshot.providerLabel} · ${snapshot.modelId}`
    : 'No provider configured'
  const latency =
    snapshot.latencyMs == null ? '' : ` · ${snapshot.latencyMs}ms`
  const stream =
    snapshot.supportsStreaming == null
      ? ''
      : snapshot.supportsStreaming
        ? ' · streaming'
        : ' · non-streaming'
  const reset =
    snapshot.quota?.resetsAt == null
      ? ''
      : ` · resets ${new Date(snapshot.quota.resetsAt * 1000).toLocaleString()}`
  const detail = snapshot.detail ? `\n${snapshot.detail}` : ''
  const providerState =
    snapshot.state === 'ready' || snapshot.state === 'limited'
      ? 'reachable'
      : snapshot.state
  const modelState = snapshot.modelState ?? 'unknown'
  // Context sizing is reported explicitly because getting it wrong is silent:
  // a wrong window renders as a plausible percentage and nothing says where
  // the number came from. stealth/ox-alpha ran at the 32k default against a
  // real 1,048,576 until someone noticed the bar filling too fast. A
  // "default" source here means the model list has not been fetched yet.
  const ctx = describeGraftContextWindow(snapshot.modelId)
  const ctxNote =
    ctx.source === 'default'
      ? ' (model unknown - run /model, or the model list has not loaded)'
      : ctx.source === 'provider'
        ? ' (provider-reported)'
        : ` (${ctx.source})`
  const context = `
Context window: ${ctx.tokens.toLocaleString()} tokens${ctxNote}`

  const output = getGraftMaxOutputLimitsForModel(snapshot.modelId)
  const maxOut = `
Max output: ${output.upperLimit.toLocaleString()} tokens`

  const descriptors = getCachedProviderModelDescriptors()
  const cache = `
Model list: ${
    descriptors?.length
      ? `${descriptors.length} models cached`
      : 'not fetched yet - context window falls back to the default'
  }`

  return `${title}
Provider: ${providerState}
Model: ${modelState}${latency}${stream}${reset}${context}${maxOut}${cache}${detail}`
}
