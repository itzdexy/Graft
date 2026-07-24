import { randomUUID } from 'node:crypto'
import { openAiModelsUrl } from '../../scripts/blink-provider-upstream.js'
import { resolveActive } from '../../scripts/blink-providers.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import { resolveModelInVerifiedList } from './validateProviderModel.js'

const CACHE_TTL_MS = 5 * 60 * 1000

type ModelCacheEntry = {
  ids: string[]
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

/** Fetch model ids the active API key can use (OpenAI /v1/models shape). */
export async function fetchActiveProviderModelIds(
  options: { force?: boolean } = {},
): Promise<string[] | null> {
  if (!isBlinkRuntime()) return null

  const active = resolveActive()
  if (!active?.apiKey || !active.baseUrl) return null

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
    const headers: Record<string, string> = {
      'x-request-id': randomUUID(),
    }
    if (active.authMode === 'authToken') {
      headers.Authorization = `Bearer ${active.apiKey}`
    } else {
      headers.Authorization = `Bearer ${active.apiKey}`
    }

    const upstreamBase =
      process.env.BLINK_OPENAI_UPSTREAM_URL?.trim() || active.baseUrl

    for (const url of [
      openAiModelsUrl(upstreamBase),
      openAiModelsUrl(active.baseUrl),
    ]) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: AbortSignal.timeout(15_000),
        })
        if (!response.ok) continue
        const payload: unknown = await response.json()
        const ids = parseOpenAiModelsList(payload)
        if (ids.length === 0) continue
        cache = {
          ids,
          fetchedAt: Date.now(),
          providerId: active.providerId,
        }
        return ids
      } catch {
        // try next url shape
      }
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
  if (!isBlinkRuntime()) return false
  const active = resolveActive()
  if (!active) return false
  if (!cache || cache.providerId !== active.providerId) return false
  return Date.now() - cache.fetchedAt < CACHE_TTL_MS
}

/** Start model-list fetch in the background (no-op when cache is already warm). */
export function prefetchActiveProviderModelIds(): void {
  if (!isBlinkRuntime()) return
  if (hasWarmProviderModelCache()) return
  void fetchActiveProviderModelIds().catch(() => {
    // First query or /model will retry; startup must not block on network.
  })
}
