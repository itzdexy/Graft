import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { formatBrowserToolCatalog } from '../../services/graft/browser/registry.js'
import {
  configurePlaywrightMcp,
  getPlaywrightMcpHint,
} from '../../services/graft/browser/playwright.js'
import { isGraftRuntime } from '../../utils/graftRuntime.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const WEB_BROWSER_TOOL_NAME = 'WebBrowser'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z
      .enum([
        'open_url',
        'read_page',
        'catalog',
        'playwright_status',
        'configure_playwright',
      ])
      .describe(
        'Static fetch guidance, browser catalog, Playwright status, or explicit Playwright setup',
      ),
    target: z
      .string()
      .optional()
      .describe('URL or search query when action needs a target'),
  }),
)

const outputSchema = lazySchema(() =>
  z.object({
    output: z.string(),
    action: z.string(),
  }),
)

function hasBunWebView(): boolean {
  return typeof Bun !== 'undefined' && 'WebView' in Bun
}

export const WebBrowserTool = buildTool({
  name: WEB_BROWSER_TOOL_NAME,
  searchHint: 'local or MCP browser (Graft WebBrowser)',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  isEnabled() {
    return isGraftRuntime()
  },
  userFacingName() {
    return 'WebBrowser'
  },
  get inputSchema() {
    return inputSchema()
  },
  get outputSchema() {
    return outputSchema()
  },
  isConcurrencySafe() {
    return false
  },
  isReadOnly(input) {
    return input.action !== 'configure_playwright'
  },
  async description(input) {
    return `Graft WebBrowser ${input.action}${input.target ? `: ${input.target.slice(0, 60)}` : ''}`
  },
  async prompt() {
    return [
      'Graft WebBrowser: browser discovery and safe Playwright setup.',
      'Prefer WebFetch/WebSearch for static pages. Use configured mcp__playwright__browser_* tools for interactive work.',
      'Use action=playwright_status to inspect setup or configure_playwright after user approval.',
      '',
      formatBrowserToolCatalog(),
    ].join('\n')
  },
  async checkPermissions(input) {
    if (input.action === 'configure_playwright') {
      return {
        behavior: 'ask',
        message:
          'Configure pinned Playwright MCP in Graft user settings and create ~/.graft/browser?',
      }
    }
    return { behavior: 'allow', updatedInput: input }
  },
  async call(input) {
    if (input.action === 'catalog') {
      return {
        data: {
          action: input.action,
          output: formatBrowserToolCatalog(),
        },
      }
    }

    if (input.action === 'playwright_status') {
      return {
        data: {
          action: input.action,
          output: getPlaywrightMcpHint(),
        },
      }
    }

    if (input.action === 'configure_playwright') {
      await configurePlaywrightMcp()
      return {
        data: {
          action: input.action,
          output: `${getPlaywrightMcpHint()}\n\nRestart Graft or run /mcp to connect it.`,
        },
      }
    }

    const url = input.target?.trim() ?? ''
    if (!url) {
      return {
        data: {
          action: input.action,
          output:
            'Provide target URL. Example: { "action": "read_page", "target": "https://example.com" }',
        },
      }
    }

    if (input.action === 'open_url' && hasBunWebView()) {
      return {
        data: {
          action: input.action,
          output: [
            'Bun WebView is available on this host.',
            `Open ${url} in the WebBrowser panel or use Playwright MCP for interactive control.`,
            `For automation: ${getPlaywrightMcpHint()}`,
          ].join('\n'),
        },
      }
    }

    return {
      data: {
        action: input.action,
        output: [
          `Use WebFetch on: ${url}`,
          'For interactive pages, use the pinned Playwright MCP runtime.',
          getPlaywrightMcpHint(),
        ].join('\n\n'),
      },
    }
  },
  mapToolResultToToolResultBlockParam({ output, action }, toolUseID) {
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content: `[WebBrowser ${action}]\n${output}`,
    }
  },
  renderToolUseMessage(input) {
    return `WebBrowser ${input.action}${input.target ? ` ${input.target}` : ''}`
  },
})
