import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { reviewPrompt } from '../../services/blink/buddy/prompts.js'
import { getCwd } from '../../utils/cwd.js'

const review: Command = {
  type: 'prompt',
  name: 'review',
  description: 'Blink Buddy — senior code review (bugs, security, maintainability)',
  argumentHint: '[files, diff, or scope]',
  progressMessage: 'reviewing code',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    return reviewPrompt(getCwd(), args.trim())
  },
}

export default review
