import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { analyzePrompt } from '../../services/tovyr/buddy/prompts.js'
import { getCwd } from '../../utils/cwd.js'

const analyze: Command = {
  type: 'prompt',
  name: 'analyze',
  description: 'Tovyr Buddy — scan repository health, debt, and risks',
  progressMessage: 'analyzing repository',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(): Promise<ContentBlockParam[]> {
    return analyzePrompt(getCwd())
  },
}

export default analyze
