import type { BlinkProjectMemory, MemoryEntry } from './memory.js'
import { listMemoryEntries, searchProjectMemory } from './memory.js'

type CacheKey = string

const searchCache = new Map<
  CacheKey,
  { at: number; query: string; hits: MemoryEntry[] }
>()

const CACHE_TTL_MS = 60_000
const CACHE_MAX_ENTRIES = 200

// The key includes the memory version (updatedAt) so a save — which bumps
// updatedAt — yields a fresh key and the stale entry can never be returned,
// even if clearMemorySearchCache was not called for some mutation path.
function cacheKey(
  cwd: string,
  version: number,
  query: string,
  limit: number,
): CacheKey {
  return `${cwd}::${version}::${query.toLowerCase()}::${limit}`
}

export function clearMemorySearchCache(cwd?: string): void {
  if (!cwd) {
    searchCache.clear()
    return
  }
  for (const key of searchCache.keys()) {
    if (key.startsWith(`${cwd}::`)) searchCache.delete(key)
  }
}

/** Drop expired entries; if still over the cap, evict the oldest. */
function pruneCache(): void {
  const now = Date.now()
  for (const [key, entry] of searchCache) {
    if (now - entry.at >= CACHE_TTL_MS) searchCache.delete(key)
  }
  while (searchCache.size > CACHE_MAX_ENTRIES) {
    // Map preserves insertion order, so the first key is the oldest.
    const oldest = searchCache.keys().next().value
    if (oldest === undefined) break
    searchCache.delete(oldest)
  }
}

/** Memoized project memory search (invalidates on save via clearMemorySearchCache). */
export function searchProjectMemoryCached(
  cwd: string,
  memory: BlinkProjectMemory,
  query: string,
  limit = 20,
): MemoryEntry[] {
  const key = cacheKey(cwd, memory.updatedAt, query, limit)
  const hit = searchCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS && hit.query === query) {
    return hit.hits
  }
  const results = searchProjectMemory(memory, query, limit)
  searchCache.set(key, { at: Date.now(), query, hits: results })
  pruneCache()
  return results
}

export function formatRelevantMemorySection(
  cwd: string,
  memory: BlinkProjectMemory,
  queryHint?: string,
): string | null {
  const entries = listMemoryEntries(memory)
  if (!entries.length) return null

  const hits = queryHint?.trim()
    ? searchProjectMemoryCached(cwd, memory, queryHint, 8)
    : listMemoryEntries(memory).slice(0, 8)

  if (!hits.length) return null

  return [
    '# Relevant project memory',
    '',
    ...hits.map(h => `- [${h.category}] ${h.text}`),
  ].join('\n')
}
