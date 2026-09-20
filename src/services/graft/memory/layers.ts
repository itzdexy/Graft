/**
 * Memory layer model (Phase 4).
 * Short-term → working → project → long-term.
 */

import { loadProjectMemory, searchProjectMemory, listMemoryEntries } from '../buddy/memory.js'
import { loadAgentSession } from '../agent/persistence.js'
import { semanticMemorySearch } from './vector.js'

export type MemoryLayer = 'short_term' | 'working' | 'project' | 'long_term'

export type MemoryLayerStatus = {
  layer: MemoryLayer
  description: string
  available: boolean
  hint: string
}

export function describeMemoryLayers(cwd: string): MemoryLayerStatus[] {
  const working = loadAgentSession(cwd)
  const project = loadProjectMemory(cwd)
  const projectFacts = listMemoryEntries(project).length

  return [
    {
      layer: 'short_term',
      description: 'REPL transcript (current session)',
      available: true,
      hint: 'Use /compact or session resume — not persisted as facts.',
    },
    {
      layer: 'working',
      description: 'Agent session steps and reflections',
      available: working != null,
      hint: working
        ? `/agent status — phase ${working.phase}`
        : 'Start `/agent start <goal>` to populate working memory.',
    },
    {
      layer: 'project',
      description: 'Buddy JSON memory per repo',
      available: projectFacts > 0,
      hint: `${projectFacts} fact(s) — /graft-memory list`,
    },
    {
      layer: 'long_term',
      description: 'Hermes personalities + global settings',
      available: true,
      hint: '/personality · provider prefs in ~/.graft/',
    },
  ]
}

export function searchAcrossMemoryLayers(
  cwd: string,
  query: string,
  limit = 10,
): { layer: MemoryLayer; text: string; score: number }[] {
  const semantic = semanticMemorySearch(cwd, query, limit)
  const merged = new Map<string, { layer: MemoryLayer; text: string; score: number }>()

  for (const entry of searchProjectMemory(loadProjectMemory(cwd), query, limit)) {
    merged.set(entry.text, { layer: 'project', text: entry.text, score: 50 })
  }
  for (const hit of semantic) {
    const prev = merged.get(hit.text)
    if (!prev || hit.score > prev.score) {
      merged.set(hit.text, { layer: hit.layer, text: hit.text, score: hit.score })
    }
  }

  return [...merged.values()].sort((a, b) => b.score - a.score).slice(0, limit)
}
