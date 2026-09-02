/**
 * Provider catalog auto-updates (Crush pattern).
 * Fetches remote model lists and merges into local provider state.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

export interface ProviderCatalogSnapshot {
  fetchedAt: string
  providers: Record<
    string,
    {
      models: string[]
      baseUrl?: string
    }
  >
}

const CACHE_DIR = join(homedir(), '.tovyr', 'catalog-cache')
const CACHE_FILE = join(CACHE_DIR, 'remote-snapshot.json')
const STALE_MS = 24 * 60 * 60 * 1000

export function getCatalogCachePath(): string {
  return CACHE_FILE
}

export function loadCatalogSnapshot(): ProviderCatalogSnapshot | null {
  if (!existsSync(CACHE_FILE)) return null
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as ProviderCatalogSnapshot
  } catch {
    return null
  }
}

export function saveCatalogSnapshot(snapshot: ProviderCatalogSnapshot): void {
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(CACHE_FILE, JSON.stringify(snapshot, null, 2), 'utf8')
}

export function isCatalogStale(snapshot: ProviderCatalogSnapshot | null): boolean {
  if (!snapshot) return true
  const age = Date.now() - new Date(snapshot.fetchedAt).getTime()
  return age > STALE_MS
}

/** Fetch Ollama tags from local daemon. */
export async function fetchOllamaModels(
  baseUrl = 'http://127.0.0.1:11434',
): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    return (data.models ?? []).map(m => m.name)
  } catch {
    return []
  }
}

/** Fetch OpenAI-compatible /models from a provider base URL. */
export async function fetchOpenAiCompatibleModels(
  baseUrl: string,
  apiKey?: string,
): Promise<string[]> {
  try {
    const headers: Record<string, string> = {}
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/models`, {
      headers,
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { data?: Array<{ id: string }> }
    return (data.data ?? []).map(m => m.id)
  } catch {
    return []
  }
}

export async function refreshProviderCatalog(opts?: {
  ollamaUrl?: string
  openAiBases?: Array<{ id: string; baseUrl: string; apiKey?: string }>
}): Promise<ProviderCatalogSnapshot> {
  const providers: ProviderCatalogSnapshot['providers'] = {}

  const ollamaModels = await fetchOllamaModels(opts?.ollamaUrl)
  if (ollamaModels.length) {
    providers.ollama = { models: ollamaModels, baseUrl: opts?.ollamaUrl }
  }

  for (const p of opts?.openAiBases ?? []) {
    const models = await fetchOpenAiCompatibleModels(p.baseUrl, p.apiKey)
    if (models.length) {
      providers[p.id] = { models, baseUrl: p.baseUrl }
    }
  }

  const snapshot: ProviderCatalogSnapshot = {
    fetchedAt: new Date().toISOString(),
    providers,
  }
  saveCatalogSnapshot(snapshot)
  return snapshot
}

export async function autoUpdateProvidersIfStale(): Promise<ProviderCatalogSnapshot | null> {
  const existing = loadCatalogSnapshot()
  if (!isCatalogStale(existing)) return existing
  return refreshProviderCatalog()
}
