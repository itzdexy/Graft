import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { formatCookbookReport } from '../../services/blink/cookbook/hardware.js'

const cookbook: Command = {
  type: 'prompt',
  name: 'cookbook',
  aliases: ['hwfit', 'what-fits'],
  description:
    'Hardware-aware model recommendations for this machine (Odysseus Cookbook-style)',
  argumentHint: '[help]',
  progressMessage: 'scanning hardware',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const trimmed = args.trim().toLowerCase()
    const report = formatCookbookReport()
    if (trimmed === 'help' || trimmed === '?') {
      return [
        {
          type: 'text',
          text: `${report}\n\nPrint the cookbook report for the user. Suggest \`/model\` and \`/provider\` next steps.`,
        },
      ]
    }
    return [
      {
        type: 'text',
        text: `Print this hardware cookbook for the user (do not run tools unless they ask to change models):\n\n${report}`,
      },
    ]
  },
}

export default cookbook
