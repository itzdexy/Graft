import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import {
  compareHelpPrompt,
  comparePrompt,
  parseCompareArgs,
} from '../../services/tovyr/compare/blindCompare.js'

const compare: Command = {
  type: 'prompt',
  name: 'compare',
  aliases: ['blind-compare', 'model-compare'],
  description:
    'Blind side-by-side model comparison (Odysseus Compare-style)',
  argumentHint: '[blind|named model-a vs model-b] <question>',
  progressMessage: 'model compare',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const trimmed = args.trim()
    if (!trimmed || trimmed === 'help' || trimmed === '?') {
      return compareHelpPrompt()
    }
    return comparePrompt(parseCompareArgs(trimmed))
  },
}

export default compare
