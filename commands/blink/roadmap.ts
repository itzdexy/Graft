import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { formatRoadmapStatus } from '../../services/blink/roadmap/phases.js'
import { formatPerformanceHints } from '../../services/blink/performance/policy.js'
import { formatModelRoutingStatus } from '../../services/blink/routing/modelRouter.js'
import { formatMcpBundleCatalog } from '../../services/blink/marketplace/bundles.js'
import { formatDevOpsCatalog } from '../../services/blink/devops/catalog.js'
import { formatComputerUseGuidance } from '../../services/blink/voice/index.js'

const roadmap: Command = {
  type: 'prompt',
  name: 'roadmap',
  aliases: ['phases'],
  description: 'Blink roadmap — GitHub issues and in-app guide',
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
