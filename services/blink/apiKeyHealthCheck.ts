import { randomUUID } from 'node:crypto'
import { resolveActive } from '../../scripts/blink-providers.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'

export const BLINK_API_KEY_CHECK_INTERVAL_MS = 5 * 60 * 1000

export type ApiKeyHealthStatus = 'valid' | 'invalid' | 'unknown' | 'skipped'

let lastCheckAt = 0
let lastStatus: ApiKeyHealthStatus = 'unknown'
let inFlight: Promise<ApiKeyHealthStatus> | null = null

export function normalizeBlinkProviderBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

export function buildBlinkApiKeyProbeUrls(baseUrl: string): string[] {
  const base = normalizeBlinkProviderBaseUrl(baseUrl)
  const urls = new Set<string>()
  urls.add(`${base}/models`)
  if (!base.endsWith('/v1')) {
    urls.add(`${base}/v1/models`)
  }
  return [...urls]
}

/**
 * Lightweight key probe — lists models metadata only (no chat completion, no tokens).
 * Returns null when the provider has no list endpoint (inconclusive).
 */
export async function probeBlinkApiKeyHealth(): Promise<boolean | null> {
  if (!isBlinkRuntime()) return null

  const active = resolveActive()
  if (!active?.apiKey || !active.baseUrl) return null

  const headers: Record<string, string> = {
    'x-request-id': randomUUID(),
  }

  if (active.authMode === 'authToken') {
    headers.Authorization = `Bearer ${active.apiKey}`
  } else {
    headers['x-api-key'] = active.apiKey
    headers['anthropic-version'] = '2023-06-01'
  }

  for (const url of buildBlinkApiKeyProbeUrls(active.baseUrl)) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10_000),
      })
      if (response.status === 401 || response.status === 403) {
        return false
      }
      if (response.ok) {
        return true
      }
    } catch {
      // try next URL shape
    }
  }

  return null
}

/** Run at most once per interval; inconclusive probes do not mark the key invalid. */
export async function checkBlinkApiKeyHealthIfDue(
  options: { force?: boolean } = {},
): Promise<ApiKeyHealthStatus> {
  if (!isBlinkRuntime()) return 'skipped'

  const now = Date.now()
  if (!options.force && now - lastCheckAt < BLINK_API_KEY_CHECK_INTERVAL_MS) {
    return 'skipped'
  }

  if (inFlight) {
    return inFlight
  }

  inFlight = (async (): Promise<ApiKeyHealthStatus> => {
    const probe = await probeBlinkApiKeyHealth()
    lastCheckAt = Date.now()
    if (probe === true) {
      lastStatus = 'valid'
      return 'valid'
    }
    if (probe === false) {
      lastStatus = 'invalid'
      return 'invalid'
    }
    lastStatus = 'unknown'
    return 'unknown'
  })()

  try {
    return await inFlight
  } finally {
    inFlight = null
  }
}

export function getLastApiKeyHealthStatus(): ApiKeyHealthStatus {
  return lastStatus
}

export function resetApiKeyHealthCheckClock(): void {
  lastCheckAt = 0
  lastStatus = 'unknown'
}
