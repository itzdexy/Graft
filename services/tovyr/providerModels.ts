import { randomUUID } from 'node:crypto'
import { openAiModelsUrl } from '../../scripts/tovyr-provider-upstream.js'
import {
  getProvider,
  resolveActive,
} from '../../scripts/tovyr-providers.js'
import { providerNeedsOpenAiCompat } from '../../scripts/tovyr-provider-upstream.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'
import { resolveModelInVerifiedList } from './validateProviderModel.js'
import type { ModelDescriptor } from './providers/types.js'
import { getTovyrWebOAuthTokensAsync } from '../../utils/auth.js'
import { OAUTH_BETA_HEADER } from '../../constants/oauth.js'
import {
  refreshSignedProviderRegistry,
  registryModelsForProvider,
} from './providers/signedRegistry.js'

const CACHE_TTL_MS = 5 * 60 * 1000

type ModelCacheEntry = {
  ids: string[]
  descriptors: ModelDescriptor[]
  fetchedAt: number
  providerId: string
}

let cache: ModelCacheEntry | null = null
let inFlight: Promise<string[] | null> | null = null

export function parseOpenAiModelsList(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) return []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const item of data) {
    if (item && typeof item === 'object' && typeof (item as { id?: string }).id === 'string') {
      const id = (item as { id: string }).id
      if (seen.has(id)) continue
      seen.add(id)
      ids.push(id)
    }
  }
  return ids
}

export function parseOpenAiModelDescriptors(payload: unknown): ModelDescriptor[] {
  return parseOpenAiModelsList(payload).map(id => ({
    id,
    displayName: id,
    available: true,
    contextTokens: null,
    maxOutputTokens: null,
    supportsTools: null,
    supportsVision: null,
    supportsReasoning: null,
    supportsStreaming: null,
    lifecycle: 'unknown',
    source: 'provider',
  }))
}

export function parseAnthropicModelDescriptors(payload: unknown): ModelDescriptor[] {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) return []
  return data.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const model = item as {
      id?: unknown
      display_name?: unknown
      max_input_tokens?: unknown
      max_tokens?: unknown
      capabilities?: {
        thinking?: { supported?: unknown }
        image_input?: { supported?: unknown }
        structured_outputs?: { supported?: unknown }
      }
    }
    if (typeof model.id !== 'string') return []
    return [{
      id: model.id,
      displayName:
        typeof model.display_name === 'string' ? model.display_name : model.id,
      available: true,
      contextTokens:
        typeof model.max_input_tokens === 'number'
          ? model.max_input_tokens
          : null,
      maxOutputTokens:
        typeof model.max_tokens === 'number' ? model.max_tokens : null,
      supportsTools:
        typeof model.capabilities?.structured_outputs?.supported === 'boolean'
          ? model.capabilities.structured_outputs.supported
          : null,
      supportsVision:
        typeof model.capabilities?.image_input?.supported === 'boolean'
          ? model.capabilities.image_input.supported
          : null,
      supportsReasoning:
        typeof model.capabilities?.thinking?.supported === 'boolean'
          ? model.capabilities.thinking.supported
          : null,
      supportsStreaming: true,
      lifecycle: 'active' as const,
      source: 'provider' as const,
    }]
  })
}

export function parseGeminiModelDescriptors(payload: unknown): ModelDescriptor[] {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as { models?: unknown }).models
  if (!Array.isArray(data)) return []
  return data.flatMap(item => {
    if (!item || typeof item !== 'object') return []
    const model = item as {
      name?: unknown
      displayName?: unknown
      inputTokenLimit?: unknown
      outputTokenLimit?: unknown
      supportedGenerationMethods?: unknown
    }
    if (typeof model.name !== 'string') return []
    const id = model.name.replace(/^models\//, '')
    const methods = Array.isArray(model.supportedGenerationMethods)
      ? model.supportedGenerationMethods.filter(
          (method): method is string => typeof method === 'string',
        )
      : []
    if (
      !methods.includes('generateContent') &&
      !methods.includes('streamGenerateContent')
    ) {
      return []
    }
    return [{
      id,
      displayName:
        typeof model.displayName === 'string' ? model.displayName : id,
      available: true,
      contextTokens:
        typeof model.inputTokenLimit === 'number'
          ? model.inputTokenLimit
          : null,
      maxOutputTokens:
        typeof model.outputTokenLimit === 'number'
          ? model.outputTokenLimit
          : null,
      supportsTools: null,
      supportsVision: null,
      supportsReasoning: null,
      supportsStreaming: methods.includes('streamGenerateContent'),
      lifecycle: /preview|experimental|exp\b/i.test(id)
        ? ('preview' as const)
        : ('active' as const),
      source: 'provider' as const,
    }]
  })
}

async function providerModelHeaders(
  active: NonNullable<ReturnType<typeof resolveActive>>,
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'x-request-id': randomUUID() }
  if (active.authMode === 'oauth') {
    const tokens = await getTovyrWebOAuthTokensAsync()
    if (tokens?.accessToken) {
      headers.Authorization = `Bearer ${tokens.accessToken}`
      headers['anthropic-beta'] = OAUTH_BETA_HEADER
    }
  } else if (active.authMode === 'authToken') {
    headers.Authorization = `Bearer ${active.apiKey}`
  } else {
    headers['x-api-key'] = active.apiKey
  }
  return headers
}

function anthropicModelsUrl(baseUrl: string): string {
  const base = baseUrl.replace(/\/+$/, '')
  if (base.endsWith('/models')) return base
  if (base.endsWith('/v1')) return `${base}/models`
  return `${base}/v1/models`
}

function geminiModelsUrl(baseUrl: string, apiKey: string): string {
  const base = (baseUrl || 'https://generativelanguage.googleapis.com')
    .replace(/\/+$/, '')
    .replace(/\/v1beta$/, '')
  const url = new URL(`${base}/v1beta/models`)
  url.searchParams.set('pageSize', '1000')
  url.searchParams.set('key', apiKey)
  return url.toString()
}

async function fetchNativeModelDescriptors(
  active: NonNullable<ReturnType<typeof resolveActive>>,
): Promise<ModelDescriptor[] | null> {
  const provider = getProvider(active.providerId)
  if (!provider) return null
  if (
    active.providerId === 'google' &&
    (active.baseUrl.includes('generativelanguage.googleapis.com') ||
      !active.baseUrl)
  ) {
    const response = await fetch(geminiModelsUrl(active.baseUrl, active.apiKey), {
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return null
    return parseGeminiModelDescriptors(await response.json())
  }
  if (!providerNeedsOpenAiCompat(provider)) {
    const headers = await providerModelHeaders(active)
    const response = await fetch(anthropicModelsUrl(active.baseUrl), {
      headers: {
        ...headers,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return null
    return parseAnthropicModelDescriptors(await response.json())
  }
  return null
}

/** Fetch model ids the active API key can use (OpenAI /v1/models shape). */
export async function fetchActiveProviderModelIds(
  options: { force?: boolean } = {},
): Promise<string[] | null> {
  if (!isTovyrRuntime()) return null

  const active = resolveActive()
  if (
    !active?.baseUrl ||
    (!active.apiKey && active.authMode !== 'oauth')
  ) {
    return null
  }

  const now = Date.now()
  if (
    !options.force &&
    cache &&
    cache.providerId === active.providerId &&
    now - cache.fetchedAt < CACHE_TTL_MS
  ) {
    return cache.ids
  }

  if (inFlight) return inFlight

  inFlight = (async () => {
    const provider = getProvider(active.providerId)
    if (!providerNeedsOpenAiCompat(provider)) {
      try {
        const descriptors = await fetchNativeModelDescriptors(active)
        if (descriptors?.length) {
          const ids = descriptors.map(model => model.id)
          cache = {
            ids,
            descriptors,
            fetchedAt: Date.now(),
            providerId: active.providerId,
          }
          return ids
        }
      } catch {
        // Continue to OpenAI-compatible discovery and the signed registry.
      }
    }

    const headers: Record<string, string> = {
      'x-request-id': randomUUID(),
      Authorization: `Bearer ${active.apiKey}`,
    }

    const upstreamBase =
      process.env.TOVYR_OPENAI_UPSTREAM_URL?.trim() || active.baseUrl

    const candidateUrls: string[] = []
    const seenUrls = new Set<string>()
    for (const base of [upstreamBase, active.baseUrl]) {
      if (!base) continue
      for (const prefix of [base, `${base}/v1`]) {
        const url = openAiModelsUrl(prefix)
        if (seenUrls.has(url)) continue
        seenUrls.add(url)
        candidateUrls.push(url)
      }
    }

    for (const url of candidateUrls) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(8_000),
        })
        if (!response.ok) continue
        const payload: unknown = await response.json()
        const descriptors = parseOpenAiModelDescriptors(payload)
        const ids = descriptors.map(model => model.id)
        if (ids.length === 0) continue
        cache = {
          ids,
          descriptors,
          fetchedAt: Date.now(),
          providerId: active.providerId,
        }
        return ids
      } catch {
        // try next url shape
      }
    }
    const registry = await refreshSignedProviderRegistry()
    const descriptors = registryModelsForProvider(
      registry,
      active.providerId,
    )
    if (descriptors.length > 0) {
      const ids = descriptors.map(model => model.id)
      cache = {
        ids,
        descriptors,
        fetchedAt: Date.now(),
        providerId: active.providerId,
      }
      return ids
    }
    return null
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

export function getCachedProviderModelIds(): string[] | null {
  const active = resolveActive()
  if (!active || !cache || cache.providerId !== active.providerId) return null
  return cache.ids
}

export function getCachedProviderModelDescriptors(): ModelDescriptor[] | null {
  const active = resolveActive()
  if (!active || !cache || cache.providerId !== active.providerId) return null
  return cache.descriptors
}

export function isModelVerifiedForActiveProvider(modelId: string): boolean | null {
  const ids = getCachedProviderModelIds()
  if (!ids) return null
  return resolveModelInVerifiedList(modelId, ids) !== null
}

export function resetProviderModelCache(): void {
  cache = null
  inFlight = null
}

/** True when a recent model list is cached for the active provider. */
export function hasWarmProviderModelCache(): boolean {
  if (!isTovyrRuntime()) return false
  const active = resolveActive()
  if (!active) return false
  if (!cache || cache.providerId !== active.providerId) return false
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS
}

/** Start model-list fetch in the background (no-op when cache is already warm). */
export function prefetchActiveProviderModelIds(): void {
  if (!isTovyrRuntime()) return
  if (hasWarmProviderModelCache()) return
  void fetchActiveProviderModelIds().catch(() => {
    // First query or /model will retry; startup must not block on network.
  })
}
