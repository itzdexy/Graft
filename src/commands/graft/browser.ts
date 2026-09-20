import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { Command, LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import {
  configurePlaywrightMcp,
  getPlaywrightMcpHint,
} from '../../services/graft/browser/playwright.js'
import {
  browserHelpPrompt,
  browserReadPrompt,
  browserResearchPrompt,
  parseBrowserArgs,
} from '../../services/graft/browser/prompts.js'
import { deepResearchPrompt } from '../../services/graft/research/deepResearch.js'

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
  if (trimmed.startsWith('test ')) {
    const url = args.trim().slice(5).trim()
    try {
      const { validateWebsiteTestUrl } = await import('../../services/graft/browser/websiteTest.js')
      validateWebsiteTestUrl(url)
      onDone(`Use WebsiteTest to inspect and test this website: ${url}\nStart with a desktop inspection, then exercise relevant controls and check the mobile layout. Report only observed results and local screenshot/report paths. Ask before submitting real transactions or changing accounts.`, { display: 'user', shouldQuery: true })
    } catch (error) {
      onDone(error instanceof Error ? error.message : 'Invalid website URL.', { display: 'system' })
    }
    return null
  }
  if (trimmed === 'setup') {
    await configurePlaywrightMcp()
    onDone(
      `${getPlaywrightMcpHint()}\n\nConfiguration saved. Restart Graft or run /mcp to connect it.`,
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
      `Playwright will connect to ${endpoint}. Enable remote debugging in the browser, then restart Graft or run /mcp.`,
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
    'test <url>|setup|status|research <topic>|read <url>',
  // The implementation is already loaded; self-imports break Bun's split bundle.
  load: async () => ({ call }),
}

export default browser
