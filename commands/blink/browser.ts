import type { Command } from '../../commands.js'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import {
  browserHelpPrompt,
  browserReadPrompt,
  browserResearchPrompt,
  parseBrowserArgs,
} from '../../services/blink/browser/prompts.js'
import {
  deepResearchPrompt,
} from '../../services/blink/research/deepResearch.js'

const browser: Command = {
  type: 'prompt',
  name: 'browser',
  description: 'Browser agent — research docs and read web pages',
  argumentHint: 'help|research <topic>|deep <question>|read <url>',
  progressMessage: 'browser research',
  contentLength: 0,
  source: 'builtin',
  async getPromptForCommand(args): Promise<ContentBlockParam[]> {
    const { sub, payload } = parseBrowserArgs(args)
    switch (sub) {
      case 'help':
        return browserHelpPrompt()
      case 'deep':
        return deepResearchPrompt(payload)
      case 'read':
        return browserReadPrompt(payload)
      case 'research':
      default:
        return browserResearchPrompt(payload)
    }
  },
}

export default browser
