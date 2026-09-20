import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import {
  getOrBuildIndex,
  repoAnalyzeSummary,
  repoGraphOutput,
  repoSearchQuery,
} from '../../services/graft/repo/analyze.js'
import { buildRankedRepoMap } from '../../services/graft/repo/repoMap.js'
import { getCwd } from '../../utils/cwd.js'

function parseRepoArgs(args: string): {
  sub: 'help' | 'analyze' | 'graph' | 'search' | 'map'
  query: string
  mermaid: boolean
} {
  const trimmed = args.trim()
  if (!trimmed || trimmed === 'help' || trimmed === '?') {
    return { sub: 'help', query: '', mermaid: false }
  }
  const [first, ...rest] = trimmed.split(/\s+/)
  const cmd = first!.toLowerCase()
  if (cmd === 'analyze') return { sub: 'analyze', query: '', mermaid: false }
  if (cmd === 'map') return { sub: 'map', query: rest.join(' ').trim(), mermaid: false }
  if (cmd === 'graph') {
    const mermaid = rest[0] === '--mermaid'
    return { sub: 'graph', query: '', mermaid }
  }
  if (cmd === 'search') return { sub: 'search', query: rest.join(' ').trim(), mermaid: false }
  return { sub: 'search', query: trimmed, mermaid: false }
}

const repo: Command = {
  type: 'prompt',
  name: 'repo',
  description: 'Repository intelligence — analyze, import graph, symbol search',
  argumentHint: 'analyze|graph|search <query>',
  progressMessage: 'indexing repository',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const cwd = getCwd()
    const { sub, query, mermaid } = parseRepoArgs(args)

    if (sub === 'help') {
      return [
        {
          type: 'text',
          text: [
            '# Graft Repo Intelligence',
            '',
            '- `/repo map [query]` — token-budget ranked repo map (symbols per file)',
            '- `/repo analyze` — file/symbol/import summary (cached index)',
            '- `/repo graph` — relative import graph (text)',
            '- `/repo graph --mermaid` — Mermaid diagram',
            '- `/repo search <query>` — symbols and files',
            '',
            'Index uses git-tracked files. Tree-sitter/ts-morph precision coming in a later phase.',
          ].join('\n'),
        },
      ]
    }

    if (sub === 'analyze') {
      const summary = await repoAnalyzeSummary(cwd)
      return [
        {
          type: 'text',
          text: `Repository analysis:\n\n${summary}\n\nExpand with Read/Grep on files above if the user wants a deeper report.`,
        },
      ]
    }

    if (sub === 'graph') {
      const graph = await repoGraphOutput(cwd, mermaid ? 'mermaid' : 'text')
      return [{ type: 'text', text: graph }]
    }

    if (sub === 'map') {
      const index = await getOrBuildIndex(cwd)
      const map = buildRankedRepoMap(index, { query: query || undefined })
      return [
        {
          type: 'text',
          text: `${map}\n\nUse Read on paths above before large refactors.`,
        },
      ]
    }

    const results = await repoSearchQuery(cwd, query || 'export')
    return [
      {
        type: 'text',
        text: `${results}\n\nUse Read tool on interesting paths for full context.`,
      },
    ]
  },
}

export default repo
