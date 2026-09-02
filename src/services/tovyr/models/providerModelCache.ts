/**
 * Per-provider cache of the models a provider actually serves.
 *
 * Tovyr previously kept ONE module-level cache slot, keyed to whichever
 * provider happened to be active. `getCachedProviderModelIds()` returned null
 * for every other provider, so the picker fell back to a hand-written catalog
 * for them — which is why OpenRouter showed "0 of 34 models" instead of the
 * hundreds it serves, and why a real model like `stealth/ox-alpha` could not be
 * found. Switching providers also threw away the previous provider's list.
 *
 * The store is keyed by provider and persisted, so a cold start shows real
 * models immediately instead of a stale catalog.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { getTovyrHome } from '../../../../scripts/tovyr-home.js'
import type { ModelDescriptor } from '../providers/types.js'

export type ProviderModelEntry = {
  providerId: string
  ids: string[]
  descriptors: ModelDescriptor[]
  fetchedAt: number
}

export type ProviderModelStore = Record<string, ProviderModelEntry>

/** Live lists change on the order of days; six hours keeps startup instant. */
export const MODEL_CACHE_TTL_MS = 6 * 60 * 60 * 1000
/** Entries older than this are dropped entirely rather than served stale. */
export const MODEL_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

// ── pure helpers ─────────────────────────────────────────────────────────

export function isEntryFresh(
  entry: ProviderModelEntry | undefined | null,
  now: number,
  ttlMs: number = MODEL_CACHE_TTL_MS,
): boolean {
  if (!entry) return false
  // A clock that jumped backwards must not make an entry immortal.
  const age = now - entry.fetchedAt
  return age >= 0 && age < ttlMs
}

/** Drop entries too old to be worth serving even as a fallback. */
export function pruneStore(
  store: ProviderModelStore,
  now: number,
  maxAgeMs: number = MODEL_CACHE_MAX_AGE_MS,
): ProviderModelStore {
  const next: ProviderModelStore = {}
  for (const [providerId, entry] of Object.entries(store)) {
    if (!entry || !Array.isArray(entry.ids)) continue
    const age = now - entry.fetchedAt
    if (age >= 0 && age > maxAgeMs) continue
    next[providerId] = entry
  }
  return next
}

/** Reject anything that is not a well-formed store, rather than throwing. */
export function parseStore(raw: unknown): ProviderModelStore {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: ProviderModelStore = {}
  for (const [providerId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue
    const entry = value as Partial<ProviderModelEntry>
    if (!Array.isArray(entry.ids)) continue
    if (typeof entry.fetchedAt !== 'number') continue
    out[providerId] = {
      providerId,
      ids: entry.ids.filter((id): id is string => typeof id === 'string'),
      descriptors: Array.isArray(entry.descriptors) ? entry.descriptors : [],
      fetchedAt: entry.fetchedAt,
    }
  }
  return out
}

// ── persistence ──────────────────────────────────────────────────────────

export function getModelCachePath(): string {
  return join(getTovyrHome(), '.tovyr', 'model-cache.json')
}

let memory: ProviderModelStore | null = null
/**
 * Set by resetProviderModelCache(). Without it a reset would simply re-read
 * the persisted file on the next access, so "cleared" would not mean empty —
 * which silently broke callers (and tests) that reset to get a cold cache.
 */
let suppressDiskRead = false

function load(): ProviderModelStore {
  if (memory) return memory
  if (suppressDiskRead) {
    memory = {}
    return memory
  }
  const path = getModelCachePath()
  if (!existsSync(path)) {
    memory = {}
    return memory
  }
  try {
    memory = pruneStore(parseStore(JSON.parse(readFileSync(path, 'utf8'))), Date.now())
  } catch {
    // A corrupt cache is a cache miss, never a startup failure.
    memory = {}
  }
  return memory
}

function persist(store: ProviderModelStore): void {
  const path = getModelCachePath()
  try {
    mkdirSync(dirname(path), { recursive: true })
    const temp = `${path}.${process.pid}.tmp`
    writeFileSync(temp, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
    renameSync(temp, path)
  } catch {
    // Cache writes are best-effort; an unwritable home must not break the CLI.
  }
}

export function getProviderModelEntry(
  providerId: string,
): ProviderModelEntry | null {
  return load()[providerId] ?? null
}

export function putProviderModelEntry(entry: ProviderModelEntry): void {
  const store = { ...load(), [entry.providerId]: entry }
  memory = store
  persist(store)
}

/** True when the in-memory store has been cleared and disk reads suppressed. */
export function isProviderModelCacheSuppressed(): boolean {
  return suppressDiskRead
}

/** Every provider we have ever fetched a list for. */
export function listCachedProviderIds(): string[] {
  return Object.keys(load())
}

/**
 * Clear the cache to genuinely empty, in memory only.
 *
 * The persisted file is left alone; call reloadProviderModelCache() to pick it
 * up again. Tests and `/provider test` rely on this meaning "no data".
 */
export function resetProviderModelCache(): void {
  memory = {}
  suppressDiskRead = true
}

/** Re-read the persisted cache after a reset. */
export function reloadProviderModelCache(): void {
  memory = null
  suppressDiskRead = false
}

/** Drop one provider's entry — used when its key changes. */
export function invalidateProviderModelEntry(providerId: string): void {
  const store = { ...load() }
  delete store[providerId]
  memory = store
  persist(store)
}
