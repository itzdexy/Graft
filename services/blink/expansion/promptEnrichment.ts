/**
 * Expansion prompt enrichment — comment tasks, theory of mind, knowledge graph.
 */

import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { scanProjectForTasks, formatTasksForPrompt } from '../../../comments/TaskTriggers.js'
import {
  updateUserModelFromPrompt,
  formatTheoryOfMindSection,
} from '../../../agents/TheoryOfMind.js'
import { formatKnowledgeGraphSection } from '../../../memory/graph.js'
import { quickThinkChain } from '../../../mcp/sequentialThinking.js'
import { getOrCreatePromptCacheEntry } from '../../../inference/promptCache.js'

export type ExpansionEnrichment = {
  blocks: ContentBlockParam[]
  notes: string[]
}

export function enrichExpansionPrompt(
  text: string,
  cwd: string,
  sessionId: string,
): ExpansionEnrichment {
  const blocks: ContentBlockParam[] = []
  const notes: string[] = []

  const tom = updateUserModelFromPrompt(sessionId, text)
  const tomSection = formatTheoryOfMindSection(tom)
  if (tomSection) {
    blocks.push({ type: 'text', text: tomSection })
    notes.push('theory-of-mind')
  }

  if (
    process.env.BLINK_COMMENT_TASKS === '1' &&
    /\b(BLINK|TODO|FIXME)\b/i.test(text) &&
    text.length < 200
  ) {
    const tasks = scanProjectForTasks(cwd, { maxFiles: 200 })
    const blinkTasks = tasks.filter(t => t.kind === 'blink' || t.kind === 'ai')
    if (blinkTasks.length) {
      blocks.push({
        type: 'text',
        text: formatTasksForPrompt(blinkTasks, cwd),
      })
      notes.push(`${blinkTasks.length} comment task(s)`)
    }
  }

  const graphSection = formatKnowledgeGraphSection(cwd, text.slice(0, 80))
  if (graphSection) {
    blocks.push({ type: 'text', text: graphSection })
    notes.push('knowledge-graph')
  }

  if (/^\/think\b/i.test(text.trim()) || /\bthink step by step\b/i.test(text)) {
    const problem = text.replace(/^\/think\s*/i, '').trim() || text
    blocks.push({ type: 'text', text: quickThinkChain(problem) })
    notes.push('sequential-thinking')
  }

  // Warm local prompt cache for stable system prefixes
  if (text.length > 200) {
    getOrCreatePromptCacheEntry(text.slice(0, 512))
  }

  return { blocks, notes }
}

export function formatExpansionBanner(notes: string[]): string | null {
  if (!notes.length) return null
  return `Expansion: ${notes.join(' · ')}`
}
