import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { agentPrompt } from '../../services/graft/agent/prompts.js'
import { getCwd } from '../../utils/cwd.js'

const fix: Command = {
  type: 'prompt',
  name: 'fix',
  description: 'Quick fix — autonomous agent with autofix on your goal',
  argumentHint: '<what to fix>',
  progressMessage: 'fixing with agent autofix',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const goal = args.trim() || 'fix issues in this project'
    return agentPrompt(getCwd(), `start --autofix ${goal}`)
  },
}

export default fix
