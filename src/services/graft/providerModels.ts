import { createHash, randomUUID } from 'node:crypto'
import { openAiModelsUrl } from '../../../scripts/graft-provider-upstream.js'
import {
  getProvider,
  resolveActive,
  resolveProviderSelection,
} from '../../../scripts/graft-providers.js'
import { providerNeedsOpenAiCompat } from '../../../scripts/graft-provider-upstream.js'
import {
  isMetaProviderId,
  metaCatalogDescriptors,
} from './metaProvider.js'
import { isGraftRuntime } from '../../utils/graftRuntime.js'
import { resolveModelInVerifiedList } from './validateProviderModel.js'
import type { ModelDescriptor } from './providers/types.js'
import { getGraftWebOAuthTokensAsync } from '../../utils/auth.js'
import { OAUTH_BETA_HEADER } from '../../constants/oauth.js'
import {
  refreshSignedProviderRegistry,
  registryModelsForProvider,
} from './providers/signedRegistry.js'
import {
  getProviderModelEntry,
  invalidateProviderModelEntry,
  isEntryFresh,
  putProviderModelEntry,
  resetProviderModelCache as resetPersistentModelCache,
} from './models/providerModelCache.js'
import {
  deriveModelTags,
  parseInputModalities,
  parseModelPricing,
  parseSupportsTools,
  parseSupportsVision,
} from './models/modelMetadata.js'

/** One in-flight request per provider, so concurrent views coalesce. */
const inFlight = new Map<string, Promise<ModelDescriptor[] | null>>()
const requestVersions = new Map<string, symbol>()
const requestSources = new Map<string, string>()

function selectionFingerprint(selection: NonNullable<ReturnType<typeof resolveProviderSelection>>): string {
  return createHash('sha256').update(JSON.stringify([
    selection.providerId, selection.baseUrl, selection.authMode, selection.apiKey,
  ])).digest('hex')
}

function matchingCache(providerId: string) {
  const selection = resolveProviderSelection(providerId, undefined)
  const entry = getProviderModelEntry(providerId)
  return selection && entry?.sourceFingerprint === selectionFingerprint(selection) ? entry : null
}

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

/**
 * Build descriptors from an OpenAI-shaped /models payload.
 *
 * This used to keep only `id` and null out every other field, discarding the
 * pricing, context length, modality and parameter list that providers such as
 * OpenRouter return for every model. That metadata is the whole basis for the
 * FREE / TOOLS / VISION / context tags in the picker, so it is now retained.
 */
export function parseOpenAiModelDescriptors(payload: unknown): ModelDescriptor[] {
  if (!payload || typeof payload !== 'object') return []
  const data = (payload as { data?: unknown }).data
  const entries = Array.isArray(data) ? data : []

  const seen = new Set<string>()
  const descriptors: ModelDescriptor[] = []

  for (const raw of entries) {
    if (!raw || typeof raw !== 'object') continue
    const item = raw as Record<string, unknown>
    const id = item.id
    if (typeof id !== 'string' || seen.has(id)) continue
    seen.add(id)

    const contextTokens =
      typeof item.context_length === 'number'
        ? item.context_length
        : typeof (item.top_provider as { context_length?: unknown } | undefined)
              ?.context_length === 'number'
          ? ((item.top_provider as { context_length: number }).context_length)
          : ([item.context_window, item.max_model_len, item.max_input_tokens]
              .find((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 1000) ?? null)

    const pricing = parseModelPricing(item.pricing)
    const supportsTools = parseSupportsTools({
      supportedParameters: item.supported_parameters,
    })
    const supportsVision = parseSupportsVision({
      architecture: item.architecture,
    })
    const modalities = parseInputModalities({ architecture: item.architecture })

    descriptors.push({
      id,
      displayName: typeof item.name === 'string' && item.name ? item.name : id,
      available: true,
      contextTokens,
      maxOutputTokens:
        typeof (item.top_provider as { max_completion_tokens?: unknown } | undefined)
          ?.max_completion_tokens === 'number'
          ? ((item.top_provider as { max_completion_tokens: number })
              .max_completion_tokens)
          : null,
      supportsTools,
      supportsVision,
      supportsReasoning: null,
      supportsStreaming: null,
      lifecycle: 'unknown',
      source: 'provider',
      pricing,
      modalities,
      tags: deriveModelTags({
        pricing,
        contextTokens,
        maxOutputTokens:
          typeof (item.top_provider as { max_completion_tokens?: unknown } | undefined)
            ?.max_completion_tokens === 'number'
            ? ((item.top_provider as { max_completion_tokens: number })
                .max_completion_tokens)
            : null,
        modalities,
        supportsTools,
        supportsVision,
      }),
    })
  }

  return descriptors
}

/**
 * Does this /models payload carry OpenAI/OpenRouter-style metadata?
 *
 * Provider flags are not a reliable guide here. OpenRouter is not marked as
 * an OpenAI-compat provider, so its rich payload was being parsed by the
 * Anthropic parser — which accepts the same `{ data: [{ id }] }` envelope and
 * silently dropped every price, context length and modality. Dispatching on
 * what actually came back keeps gateways working whatever they are flagged as.
 */
export function payloadHasOpenAiModelMetadata(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false
  const data = (payload as { data?: unknown }).data
  if (!Array.isArray(data)) return false
  return data.some(item => {
    if (!item || typeof item !== 'object') return false
    const record = item as Record<string, unknown>
    return (
      record.pricing !== undefined ||
      record.context_length !== undefined ||
      record.architecture !== undefined ||
      record.supported_parameters !== undefined ||
      record.top_provider !== undefined
    )
  })
}

/** Parse a model list, choosing the parser that keeps the most metadata. */
export function parseModelListPayload(payload: unknown): ModelDescriptor[] {
  return payloadHasOpenAiModelMetadata(payload)
    ? parseOpenAiModelDescriptors(payload)
    : parseAnthropicModelDescriptors(payload)
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
    const tokens = await getGraftWebOAuthTokensAsync()
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

/**
 * Model-list URLs to try for an OpenAI-compatible provider, in order.
 *
 * Providers disagree on whether the configured base already carries the `/v1`
 * segment, so an unversioned base is probed both ways. A base that already ends
 * in `/v1` is not re-versioned — that produced a bogus `/v1/v1/models` request
 * that 404s on every provider and delayed real model discovery.
 */
export function buildOpenAiModelListCandidateUrls(
  baseUrls: (string | undefined | null)[],
): string[] {
  const urls: string[] = []
  const seen = new Set<string>()
  for (const baseUrl of baseUrls) {
    const base = (baseUrl || '').replace(/\/+$/, '')
    if (!base) continue
    const prefixes = base.endsWith('/v1') ? [base] : [base, `${base}/v1`]
    for (const prefix of prefixes) {
      const url = openAiModelsUrl(prefix)
      if (seen.has(url)) continue
      seen.add(url)
      urls.push(url)
    }
  }
  return urls
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
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return null
    return parseGeminiModelDescriptors(await response.json())
  }
  if (!providerNeedsOpenAiCompat(provider)) {
    const headers = await providerModelHeaders(active)
    const response = await fetch(anthropicModelsUrl(active.baseUrl), {
      redirect: 'error',
      headers: {
        ...headers,
        'anthropic-version': '2023-06-01',
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return null
    return parseModelListPayload(await response.json())
  }
  return null
}

/** Fetch model ids the active API key can use (OpenAI /v1/models shape). */
/**
 * Fetch the models a provider actually serves.
 *
 * Generalized from an active-provider-only fetch. The picker needs live lists
 * for every connected provider, not just the one currently selected —
 * otherwise every other provider falls back to the static catalog, which is
 * how OpenRouter ended up showing 34 of its several hundred models.
 */
export async function fetchProviderModels(
  providerId: string,
  options: { force?: boolean } = {},
): Promise<ModelDescriptor[] | null> {
  if (!isGraftRuntime()) return null

  const selection = resolveProviderSelection(providerId, undefined)
  if (
    !selection?.baseUrl ||
    (!selection.apiKey && selection.authMode !== 'oauth')
  ) {
    return null
  }

  const sourceFingerprint = selectionFingerprint(selection)
  const cached = matchingCache(providerId)
  if (!options.force && isEntryFresh(cached, Date.now())) {
    return cached!.descriptors
  }

  const existing = inFlight.get(providerId)
  if (existing && requestSources.get(providerId) === sourceFingerprint) return existing

  const version = Symbol(providerId)
  requestVersions.set(providerId, version)
  requestSources.set(providerId, sourceFingerprint)
  const run = (async (): Promise<ModelDescriptor[] | null> => {
    const commit = (descriptors: ModelDescriptor[]): ModelDescriptor[] | null => {
      // A key/endpoint change must not let an older request repopulate the cache.
      if (requestVersions.get(providerId) !== version) return null
      const current = resolveProviderSelection(providerId, undefined)
      if (!current || selectionFingerprint(current) !== sourceFingerprint) return null
      putProviderModelEntry({
        providerId,
        ids: descriptors.map(model => model.id),
        descriptors,
        fetchedAt: Date.now(),
        sourceFingerprint,
      })
      return descriptors
    }

    const provider = getProvider(providerId)
    if (isMetaProviderId(providerId)) {
      const descriptors = metaCatalogDescriptors()
      if (descriptors.length > 0) return commit(descriptors)
    }
    if (!providerNeedsOpenAiCompat(provider)) {
      try {
        const descriptors = await fetchNativeModelDescriptors(selection)
        if (descriptors?.length) return commit(descriptors)
      } catch {
        // Continue to OpenAI-compatible discovery and the signed registry.
      }
    }

    const headers: Record<string, string> = {
      'x-request-id': randomUUID(),
      Authorization: `Bearer ${selection.apiKey}`,
    }

    const candidateUrls = buildOpenAiModelListCandidateUrls([
      selection.baseUrl,
    ])

    for (const url of candidateUrls) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          redirect: 'error',
          headers,
          signal: AbortSignal.timeout(8_000),
        })
        if (!response.ok) continue
        const descriptors = parseOpenAiModelDescriptors(await response.json())
        if (descriptors.length === 0) continue
        return commit(descriptors)
      } catch {
        // try next url shape
      }
    }

    const registry = await refreshSignedProviderRegistry()
    const descriptors = registryModelsForProvider(registry, providerId)
    if (descriptors.length > 0) return commit(descriptors)

    // Nothing live. A stale entry still beats a hand-written catalog.
    return requestVersions.get(providerId) === version ? cached?.descriptors ?? null : null
  })()

  inFlight.set(providerId, run)
  try {
    return await run
  } finally {
    if (inFlight.get(providerId) === run) inFlight.delete(providerId)
  }
}

/** Model ids a provider serves. Cached per provider and persisted. */
export async function fetchProviderModelIds(
  providerId: string,
  options: { force?: boolean } = {},
): Promise<string[] | null> {
  const descriptors = await fetchProviderModels(providerId, options)
  return descriptors ? descriptors.map(model => model.id) : null
}

/** Fetch model ids the active API key can use. */
export async function fetchActiveProviderModelIds(
  options: { force?: boolean } = {},
): Promise<string[] | null> {
  const active = resolveActive()
  if (!active) return null
  return fetchProviderModelIds(active.providerId, options)
}

export function getCachedProviderModelIdsFor(
  providerId: string,
): string[] | null {
  return matchingCache(providerId)?.ids ?? null
}

export function getCachedProviderModelDescriptorsFor(
  providerId: string,
): ModelDescriptor[] | null {
  return matchingCache(providerId)?.descriptors ?? null
}

export function getCachedProviderModelIds(): string[] | null {
  const active = resolveActive()
  if (!active) return null
  return getCachedProviderModelIdsFor(active.providerId)
}

export function getCachedProviderModelDescriptors(): ModelDescriptor[] | null {
  const active = resolveActive()
  if (!active) return null
  return getCachedProviderModelDescriptorsFor(active.providerId)
}

export function isModelVerifiedForActiveProvider(modelId: string): boolean | null {
  const ids = getCachedProviderModelIds()
  if (!ids) return null
  return resolveModelInVerifiedList(modelId, ids) !== null
}

export function resetProviderModelCache(): void {
  inFlight.clear()
  requestVersions.clear()
  requestSources.clear()
  resetPersistentModelCache()
}

/** Drop one provider's cached list — call when its key or endpoint changes. */
export function invalidateProviderModels(providerId: string): void {
  inFlight.delete(providerId)
  requestVersions.delete(providerId)
  requestSources.delete(providerId)
  invalidateProviderModelEntry(providerId)
}

/** True when a recent model list is cached for the active provider. */
export function hasWarmProviderModelCache(providerId?: string): boolean {
  if (!isGraftRuntime()) return false
  const id = providerId ?? resolveActive()?.providerId
  if (!id) return false
  return isEntryFresh(matchingCache(id), Date.now())
}

/** Start model-list fetch in the background (no-op when cache is already warm). */
export function prefetchActiveProviderModelIds(): void {
  if (!isGraftRuntime()) return
  if (hasWarmProviderModelCache()) return
  void fetchActiveProviderModelIds().catch(() => {
    // First query or /model will retry; startup must not block on network.
  })
}

/**
 * Warm every connected provider in the background.
 *
 * The picker lists models across providers, so a cold cache for a
 * non-active provider is what makes that list fall back to the catalog.
 */
export function prefetchConnectedProviderModels(providerIds: string[]): void {
  if (!isGraftRuntime()) return
  for (const providerId of providerIds) {
    if (isEntryFresh(getProviderModelEntry(providerId), Date.now())) continue
    void fetchProviderModels(providerId).catch(() => {
      // Best effort; the picker retries on view.
    })
  }
}
