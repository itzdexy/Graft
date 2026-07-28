import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { debugPrompt } from '../../services/tovyr/buddy/prompts.js'
import { getCwd } from '../../utils/cwd.js'

const debug: Command = {
  type: 'prompt',
  name: 'debug',
  description: 'Tovyr Buddy — diagnose bugs with ranked causes and confidence',
  argumentHint: '<issue description>',
  progressMessage: 'debugging',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    return debugPrompt(getCwd(), args.trim())
  },
}

export default debug
