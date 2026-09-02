import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command, LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import {
  configurePlaywrightMcp,
  getPlaywrightMcpHint,
} from '../../services/tovyr/browser/playwright.js'
import {
  browserHelpPrompt,
  browserReadPrompt,
  browserResearchPrompt,
  parseBrowserArgs,
} from '../../services/tovyr/browser/prompts.js'
import { deepResearchPrompt } from '../../services/tovyr/research/deepResearch.js'

function promptText(blocks: ContentBlockParam[]): string {
  return blocks
    .map(block => (block.type === 'text' ? block.text : ''))
    .filter(Boolean)
    .join('\n')
}

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  args: string,
): Promise<null> {
  const trimmed = args.trim().toLowerCase()
  if (trimmed === 'setup') {
    await configurePlaywrightMcp()
    onDone(
      `${getPlaywrightMcpHint()}\n\nConfiguration saved. Restart Tovyr or run /mcp to connect it.`,
      { display: 'system' },
    )
    return null
  }
  if (trimmed === 'status') {
    onDone(getPlaywrightMcpHint(), { display: 'system' })
    return null
  }
  if (trimmed === 'connect chrome' || trimmed === 'connect edge') {
    const endpoint = trimmed.endsWith('edge') ? 'msedge' : 'chrome'
    await configurePlaywrightMcp({ kind: 'cdp', endpoint })
    onDone(
      `Playwright will connect to ${endpoint}. Enable remote debugging in the browser, then restart Tovyr or run /mcp.`,
      { display: 'system' },
    )
    return null
  }

  const { sub, payload } = parseBrowserArgs(args)
  const blocks =
    sub === 'deep'
      ? deepResearchPrompt(payload)
      : sub === 'read'
        ? browserReadPrompt(payload)
        : sub === 'research'
          ? browserResearchPrompt(payload)
          : browserHelpPrompt()
  onDone(promptText(blocks), {
    display: sub === 'help' ? 'system' : 'user',
    shouldQuery: sub !== 'help',
  })
  return null
}

const browser: Command = {
  type: 'local-jsx',
  name: 'browser',
  description: 'Browser automation, setup, status, and research',
  argumentHint:
    'setup|status|connect chrome|research <topic>|deep <question>|read <url>',
  load: () => import('./browser.js'),
}

export default browser
