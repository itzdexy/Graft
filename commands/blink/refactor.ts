import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { refactorPrompt } from '../../services/blink/buddy/prompts.js'
import { getCwd } from '../../utils/cwd.js'

const refactor: Command = {
  type: 'prompt',
  name: 'refactor',
  description: 'Blink Buddy — improve code quality in a path or module',
  argumentHint: '[path]',
  progressMessage: 'refactoring',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    return refactorPrompt(getCwd(), args.trim())
  },
}

export default refactor
