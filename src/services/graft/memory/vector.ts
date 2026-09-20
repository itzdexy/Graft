/**
 * Vector / semantic memory (Phase 12).
 * Feature flag: GRAFT_VECTOR_MEMORY=1 (future: Qdrant/Chroma).
 * Today: enhanced keyword scoring over project memory.
 */

import { loadProjectMemory, searchProjectMemory } from '../buddy/memory.js'
import type { MemoryLayer } from './layers.js'

export function isVectorMemoryEnabled(): boolean {
  return process.env.GRAFT_VECTOR_MEMORY === '1'
}

export type SemanticMemoryHit = {
  layer: MemoryLayer
  text: string
  score: number
}

/** Semantic search — vector backend when enabled; keyword fallback otherwise. */
export function semanticMemorySearch(
  cwd: string,
  query: string,
  limit = 10,
): SemanticMemoryHit[] {
  const memory = loadProjectMemory(cwd)
  const hits = searchProjectMemory(memory, query, limit * 2)

  if (!isVectorMemoryEnabled()) {
    return hits.map(h => ({ layer: 'project' as const, text: h.text, score: 50 }))
  }

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
  return hits
    .map(h => {
      const lower = h.text.toLowerCase()
      const overlap = tokens.filter(t => lower.includes(t)).length
      const boost = overlap > 1 ? overlap * 5 : 0
      return { layer: 'project' as const, text: h.text, score: 50 + boost }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function formatVectorMemoryStatus(): string {
  if (!isVectorMemoryEnabled()) {
    return 'Vector memory: off (keyword search). Set GRAFT_VECTOR_MEMORY=1 for semantic boost; Qdrant/Chroma planned.'
  }
  return 'Vector memory: semantic boost on (keyword + token overlap). Full embedding store planned.'
}
