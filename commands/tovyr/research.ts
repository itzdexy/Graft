import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { researchPrompt } from '../../services/tovyr/buddy/prompts.js'
import { getCwd } from '../../utils/cwd.js'

const research: Command = {
  type: 'prompt',
  name: 'research',
  description: 'Tovyr Buddy — research docs, APIs, and implementation options',
  argumentHint: '<topic>',
  progressMessage: 'researching',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    return researchPrompt(getCwd(), args.trim())
  },
}

export default research
