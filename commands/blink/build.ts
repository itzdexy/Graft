import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { buildPrompt } from '../../services/blink/buddy/prompts.js'
import { getCwd } from '../../utils/cwd.js'

const build: Command = {
  type: 'prompt',
  name: 'build',
  description: 'Blink Buddy — implement a feature end-to-end',
  argumentHint: '<feature description>',
  progressMessage: 'building feature',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    return buildPrompt(getCwd(), args.trim())
  },
}

export default build
