/**
 * Local prompt / prefix caching for repeated system prompts (llama.cpp pattern).
 */

import { createHash } from 'node:crypto'

export interface PromptCacheEntry {
  hash: string
  prefix: string
  tokenEstimate: number
  hits: number
  createdAt: number
  lastUsedAt: number
}

const cache = new Map<string, PromptCacheEntry>()
const MAX_ENTRIES = 32

function hashPrefix(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function getOrCreatePromptCacheEntry(prefix: string): PromptCacheEntry {
  const hash = hashPrefix(prefix)
  const existing = cache.get(hash)
  if (existing) {
    existing.hits++
    existing.lastUsedAt = Date.now()
    return existing
  }
  const entry: PromptCacheEntry = {
    hash,
    prefix,
    tokenEstimate: estimateTokens(prefix),
    hits: 0,
    createdAt: Date.now(),
    lastUsedAt: Date.now(),
  }
  if (cache.size >= MAX_ENTRIES) {
    const oldest = [...cache.values()].sort(
      (a, b) => a.lastUsedAt - b.lastUsedAt,
    )[0]
    if (oldest) cache.delete(oldest.hash)
  }
  cache.set(hash, entry)
  return entry
}

export function lookupPromptCache(prefix: string): PromptCacheEntry | undefined {
  const hash = hashPrefix(prefix)
  const entry = cache.get(hash)
  if (entry) {
    entry.hits++
    entry.lastUsedAt = Date.now()
  }
  return entry
}

export function getPromptCacheStats(): {
  entries: number
  totalHits: number
  savedTokenEstimate: number
} {
  let totalHits = 0
  let savedTokenEstimate = 0
  for (const e of cache.values()) {
    totalHits += e.hits
    savedTokenEstimate += e.hits * e.tokenEstimate
  }
  return { entries: cache.size, totalHits, savedTokenEstimate }
}

export function clearPromptCache(): void {
  cache.clear()
}

/** llama.cpp / server flag for prefix caching. */
export function toPromptCacheFlags(enabled = true): Record<string, boolean> {
  return { 'prompt-cache': enabled }
}
