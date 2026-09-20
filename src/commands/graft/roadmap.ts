import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { formatRoadmapStatus } from '../../services/graft/roadmap/phases.js'
import { formatPerformanceHints } from '../../services/graft/performance/policy.js'
import { formatModelRoutingStatus } from '../../services/graft/routing/modelRouter.js'
import { formatMcpBundleCatalog } from '../../services/graft/marketplace/bundles.js'
import { formatDevOpsCatalog } from '../../services/graft/devops/catalog.js'
import { formatComputerUseGuidance } from '../../services/graft/voice/index.js'

const roadmap: Command = {
  type: 'prompt',
  name: 'roadmap',
  aliases: ['phases'],
  description: 'Graft roadmap — GitHub issues and in-app guide',
  argumentHint: '[performance|routing|devops|mcp]',
  progressMessage: 'loading roadmap',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const topic = args.trim().toLowerCase()
    if (!topic || topic === 'help') {
      return [{ type: 'text', text: formatRoadmapStatus() }]
    }
    if (topic === 'performance' || topic === 'perf') {
      return [{ type: 'text', text: formatPerformanceHints() }]
    }
    if (topic === 'routing' || topic === 'models') {
      return [{ type: 'text', text: formatModelRoutingStatus() }]
    }
    if (topic === 'devops') {
      return [{ type: 'text', text: formatDevOpsCatalog() }]
    }
    if (topic === 'mcp' || topic === 'marketplace') {
      return [{ type: 'text', text: formatMcpBundleCatalog() }]
    }
    if (topic === 'voice' || topic === 'computer') {
      return [{ type: 'text', text: formatComputerUseGuidance() }]
    }
    return [
      {
        type: 'text',
        text: `${formatRoadmapStatus()}\n\nUnknown topic \`${topic}\`. Try: performance, routing, devops, mcp, voice.`,
      },
    ]
  },
}

export default roadmap
