import { randomUUID } from 'node:crypto'
import { OAUTH_BETA_HEADER } from '../../../constants/oauth.js'
import {
  getProvider,
  resolveActive,
  resolveProviderSelection,
} from '../../../scripts/tovyr-providers.js'
import {
  openAiChatCompletionsUrl,
  providerNeedsOpenAiCompat,
} from '../../../scripts/tovyr-provider-upstream.js'
import { getTovyrWebOAuthTokensAsync } from '../../../utils/auth.js'
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

const PROBE_TIMEOUT_MS = 5_000
const PROBE_CACHE_TTL_MS = 5 * 60 * 1000
const PROBE_MAX_OUTPUT_TOKENS = 8
const MAX_PROBE_STREAM_BYTES = 64 * 1024

type ActiveProvider = NonNullable<ReturnType<typeof resolveActive>>
type ProbeResult = {
  supportsStreaming: boolean
  text: string
  headers: Headers
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
    const tokens = await getTovyrWebOAuthTokensAsync()
    if (!tokens?.accessToken) throw new Error('No Tovyr OAuth token is available.')
    headers.Authorization = `Bearer ${tokens.accessToken}`
    headers['anthropic-beta'] = OAUTH_BETA_HEADER
  } else if (active.authMode === 'authToken') {
    headers.Authorization = `Bearer ${active.apiKey}`
  } else {
    headers['x-api-key'] = active.apiKey
  }
  return headers
}

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const root = payload as Record<string, unknown>
  const choices = root.choices
  if (Array.isArray(choices)) {
    const first = choices[0] as Record<string, unknown> | undefined
    const message = first?.message as Record<string, unknown> | undefined
    if (typeof message?.content === 'string') return message.content
  }
  const content = root.content
  if (Array.isArray(content)) {
    return content
      .map(block =>
        block &&
        typeof block === 'object' &&
        typeof (block as { text?: unknown }).text === 'string'
          ? String((block as { text: string }).text)
          : '',
      )
      .join('')
  }
  return typeof root.output_text === 'string' ? root.output_text : ''
}

function extractSseText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const root = payload as Record<string, unknown>
  const delta = root.delta as Record<string, unknown> | undefined
  if (typeof delta?.text === 'string') return delta.text
  const choices = root.choices
  if (Array.isArray(choices)) {
    const first = choices[0] as Record<string, unknown> | undefined
    const choiceDelta = first?.delta as Record<string, unknown> | undefined
    if (typeof choiceDelta?.content === 'string') return choiceDelta.content
  }
  return ''
}

async function readProbeResponse(response: Response): Promise<ProbeResult> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('text/event-stream') || !response.body) {
    const payload = (await response.json().catch(() => null)) as unknown
    return {
      supportsStreaming: false,
      text: extractText(payload),
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

async function fetchOpenAiProbe(
  active: ActiveProvider,
  signal: AbortSignal,
): Promise<Response> {
  const headers = await authHeaders(active)
  // OpenAI-compatible gateways differ on whether baseUrl already includes /v1.
  const bases = [
    process.env.TOVYR_OPENAI_UPSTREAM_URL?.trim(),
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
        stream: true,
        temperature: 0,
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
  return fetch(anthropicMessagesUrl(active.baseUrl), {
    method: 'POST',
    headers: {
      ...headers,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: active.model,
      max_tokens: PROBE_MAX_OUTPUT_TOKENS,
      stream: true,
      messages: [
        {
          role: 'user',
          content: 'Connection check. Reply with exactly OK.',
        },
      ],
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

function stateForError(kind: ProviderErrorKind): ProviderConnectionSnapshot['state'] {
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

async function performProbe(active: ActiveProvider): Promise<ProviderConnectionSnapshot> {
  const startedAt = Date.now()
  const timeout = AbortSignal.timeout(PROBE_TIMEOUT_MS)
  try {
    const result = await runTransportProbe(active, timeout)
    const quota = readProviderQuota(result.headers)
    const capabilities = resolveModelCapabilities(active.model, active.providerId)
    const text = result.text.trim()
    const state = stateForProbeResult({ text, quota })
    return {
      state,
      providerId: active.providerId,
      providerLabel: active.label,
      modelId: active.model,
      checkedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
      supportsStreaming: result.supportsStreaming,
      supportsTools: capabilities.toolCalling,
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
    const quota = candidate.headers
      ? readProviderQuota(candidate.headers)
      : undefined
    return {
      state: stateForError(classified.kind),
      providerId: active.providerId,
      providerLabel: active.label,
      modelId: active.model,
      checkedAt: Date.now(),
      latencyMs: Date.now() - startedAt,
      quota:
        classified.kind === 'rate_limit' ||
        classified.kind === 'quota_exceeded'
          ? { ...(quota ?? {}), limited: true }
          : quota,
      errorKind: classified.kind,
      detail: safeDetail(classified.message),
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
  if (
    !options.force &&
    cached &&
    cached.providerId === active.providerId &&
    cached.modelId === active.model &&
    cached.checkedAt &&
    Date.now() - cached.checkedAt < PROBE_CACHE_TTL_MS
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

/** Probe a candidate without mutating the user's active provider/model. */
export async function probeProviderModel(input: { providerId: string; modelId: string }): Promise<{ ok: boolean; latencyMs: number; readiness: 'ready' | 'chat_only' | 'slow' | 'unavailable'; detail?: string }> {
  const active = resolveProviderSelection(input.providerId, input.modelId)
  if (!active) return { ok: false, latencyMs: 0, readiness: 'unavailable', detail: 'Provider is not configured.' }
  const snapshot = await performProbe(active)
  const readiness = snapshot.state === 'ready' ? snapshot.supportsTools === false ? 'chat_only' : 'ready' : snapshot.state === 'offline' ? 'slow' : 'unavailable'
  return { ok: readiness === 'ready' || readiness === 'chat_only', latencyMs: snapshot.latencyMs ?? 0, readiness, detail: snapshot.detail }
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
  return `${title}\nStatus: ${snapshot.state}${latency}${stream}${reset}${detail}`
}
