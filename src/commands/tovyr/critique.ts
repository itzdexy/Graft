import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import { critiqueHelpPrompt, critiquePrompt } from '../../services/tovyr/multiagent/prompts.js'
import { parseCritiqueArgs } from '../../services/tovyr/multiagent/parseArgs.js'
import { getCwd } from '../../utils/cwd.js'

async function getCritiquePrompt(args: string): Promise<ContentBlockParam[]> {
  const trimmed = args.trim()
  if (!trimmed || trimmed === 'help' || trimmed === '?') {
    return critiqueHelpPrompt()
  }
  return critiquePrompt(getCwd(), parseCritiqueArgs(trimmed))
}

const critique: Command = {
  type: 'prompt',
  name: 'critique',
  description:
    'Multi-agent critique — writer+editor or coder+reviewer pairs debate and revise',
  argumentHint: '[writer|coder] [rounds=N] <task>',
  progressMessage: 'running multi-agent critique',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    return getCritiquePrompt(args)
  },
}

/** Alias for discoverability — same behavior as /critique */
const multiagent: Command = {
  ...critique,
  name: 'multiagent',
  description: 'Alias for /critique — paired agents that critique each other',
}

export default critique
export { multiagent }
