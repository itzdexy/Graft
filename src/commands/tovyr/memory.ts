import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import {
  clearProjectMemory,
  formatMemoryList,
  formatMemorySearchResults,
  loadProjectMemory,
  searchProjectMemory,
} from '../../services/tovyr/buddy/memory.js'
import { searchAcrossMemoryLayers, describeMemoryLayers } from '../../services/tovyr/memory/layers.js'
import { formatVectorMemoryStatus } from '../../services/tovyr/memory/vector.js'
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

const tovyrMemory: Command = {
  type: 'prompt',
  name: 'tovyr-memory',
  aliases: ['kmemory', 'project-memory'],
  description: 'Tovyr project memory — list, search, or clear Buddy memory',
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
            '# Tovyr Project Memory',
            '',
            'Layers: short-term (session), working (agent), project (this command), long-term (personality/settings).',
            '',
            describeMemoryLayers(cwd)
              .map(l => `- **${l.layer}**: ${l.hint}`)
              .join('\n'),
            '',
            formatVectorMemoryStatus(),
            '',
            '- `/tovyr-memory list` — all stored facts',
            '- `/tovyr-memory search <query>` — semantic keyword search',
            '- `/tovyr-memory clear` — reset project memory (confirm with user first)',
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
          text: 'The user invoked `/tovyr-memory clear`. Confirm they want to erase all project memory, then if they confirm call clear and report result. Do not clear without explicit confirmation in this turn.',
        },
      ]
    }

    const hits =
      process.env.TOVYR_VECTOR_MEMORY === '1'
        ? searchAcrossMemoryLayers(cwd, query).map(h => ({
            category: 'goals' as const,
            text: h.text,
          }))
        : searchProjectMemory(memory, query)
    return [{ type: 'text', text: formatMemorySearchResults(query, hits) }]
  },
}

export default tovyrMemory

/** Non-interactive clear for tests */
export function clearMemoryForProject(cwd: string): void {
  clearProjectMemory(cwd)
}
