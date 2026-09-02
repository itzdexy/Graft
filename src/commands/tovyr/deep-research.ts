import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import {
  deepResearchHelpPrompt,
  deepResearchPrompt,
  parseDeepResearchArgs,
} from '../../services/tovyr/research/deepResearch.js'

const deepResearch: Command = {
  type: 'prompt',
  name: 'deep-research',
  aliases: ['deepresearch', 'odysseus-research'],
  description:
    'Deep Research — multi-step web research with cited report (Odysseus-style)',
  argumentHint: 'help|<question>',
  progressMessage: 'deep research',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const { sub, topic } = parseDeepResearchArgs(args)
    if (sub === 'help') return deepResearchHelpPrompt()
    return deepResearchPrompt(topic)
  },
}

export default deepResearch
