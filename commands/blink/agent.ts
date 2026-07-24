import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { agentPrompt } from '../../services/blink/agent/prompts.js'
import { getCwd } from '../../utils/cwd.js'

const agent: Command = {
  type: 'prompt',
  name: 'agent',
  aliases: ['autofix'],
  description:
    'Autonomous agent loop — observe, plan, execute, verify, reflect on a goal',
  argumentHint: 'start|verify|autofix|status|timeline|activity|resume|stop|help [--autofix] [goal]',
  progressMessage: 'running agent loop',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    return agentPrompt(getCwd(), args)
  },
}

export default agent
