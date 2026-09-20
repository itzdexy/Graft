import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import {
  clearProjectMemory,
  formatMemoryList,
  formatMemorySearchResults,
  loadProjectMemory,
  searchProjectMemory,
} from '../../services/graft/buddy/memory.js'
import { searchAcrossMemoryLayers, describeMemoryLayers } from '../../services/graft/memory/layers.js'
import { formatVectorMemoryStatus } from '../../services/graft/memory/vector.js'
import { getCwd } from '../../utils/cwd.js'

function parseMemoryArgs(args: string): {
  sub: 'help' | 'list' | 'search' | 'clear'
  query: string
} {
  const trimmed = args.trim()
  if (!trimmed || trimmed === 'help' || trimmed === '?') {
    return { sub: 'help', query: '' }
  }
  const [first, ...rest] = trimmed.split(/\s+/)
  const cmd = first!.toLowerCase()
  if (cmd === 'list') return { sub: 'list', query: '' }
  if (cmd === 'search') return { sub: 'search', query: rest.join(' ').trim() }
  if (cmd === 'clear') return { sub: 'clear', query: '' }
  return { sub: 'search', query: trimmed }
}

const graftMemory: Command = {
  type: 'prompt',
  name: 'graft-memory',
  aliases: ['kmemory', 'project-memory'],
  description: 'Graft project memory — list, search, or clear Buddy memory',
  argumentHint: 'list|search|clear [query]',
  progressMessage: 'reading project memory',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const cwd = getCwd()
    const { sub, query } = parseMemoryArgs(args)
    const memory = loadProjectMemory(cwd)

    if (sub === 'help') {
      return [
        {
          type: 'text',
          text: [
            '# Graft Project Memory',
            '',
            'Layers: short-term (session), working (agent), project (this command), long-term (personality/settings).',
            '',
            describeMemoryLayers(cwd)
              .map(l => `- **${l.layer}**: ${l.hint}`)
              .join('\n'),
            '',
            formatVectorMemoryStatus(),
            '',
            '- `/graft-memory list` — all stored facts',
            '- `/graft-memory search <query>` — semantic keyword search',
            '- `/graft-memory clear` — reset project memory (confirm with user first)',
            '',
            'Also: `/buddy remember <fact>` and `## Memory updates` in agent output.',
          ].join('\n'),
        },
      ]
    }

    if (sub === 'list') {
      return [{ type: 'text', text: formatMemoryList(memory) }]
    }

    if (sub === 'clear') {
      return [
        {
          type: 'text',
          text: 'The user invoked `/graft-memory clear`. Confirm they want to erase all project memory, then if they confirm call clear and report result. Do not clear without explicit confirmation in this turn.',
        },
      ]
    }

    const hits =
      process.env.GRAFT_VECTOR_MEMORY === '1'
        ? searchAcrossMemoryLayers(cwd, query).map(h => ({
            category: 'goals' as const,
            text: h.text,
          }))
        : searchProjectMemory(memory, query)
    return [{ type: 'text', text: formatMemorySearchResults(query, hits) }]
  },
}

export default graftMemory

/** Non-interactive clear for tests */
export function clearMemoryForProject(cwd: string): void {
  clearProjectMemory(cwd)
}
