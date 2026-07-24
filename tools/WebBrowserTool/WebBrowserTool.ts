import { z } from 'zod/v4'
import { buildTool } from '../../Tool.js'
import { formatBrowserToolCatalog } from '../../services/blink/browser/registry.js'
import { getPlaywrightMcpHint } from '../../services/blink/browser/playwright.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const WEB_BROWSER_TOOL_NAME = 'WebBrowser'

const inputSchema = lazySchema(() =>
  z.strictObject({
    action: z
      .enum(['open_url', 'read_page', 'catalog', 'playwright_hint'])
      .describe('open_url/read_page for static fetch; catalog lists browser tools; playwright_hint for MCP setup'),
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
  searchHint: 'local or MCP browser (Blink WebBrowser)',
  maxResultSizeChars: 100_000,
  shouldDefer: true,
  isEnabled() {
    return isBlinkRuntime()
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
  isReadOnly() {
    return true
  },
  async description(input) {
    return `Blink WebBrowser ${input.action}${input.target ? `: ${input.target.slice(0, 60)}` : ''}`
  },
  async prompt() {
    return [
      'Blink WebBrowser — unified browser surface (Phases 2 & 11).',
      'Prefer WebFetch/WebSearch for static pages; use BrowserUse for cloud interactive sessions.',
      'Use action=playwright_hint when Playwright MCP is needed for tabs, forms, or screenshots.',
      '',
      formatBrowserToolCatalog(),
    ].join('\n')
  },
  async checkPermissions() {
    return { behavior: 'allow', updatedInput: undefined }
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

    if (input.action === 'playwright_hint') {
      return {
        data: {
          action: input.action,
          output: getPlaywrightMcpHint(),
        },
      }
    }

    const url = input.target?.trim() ?? ''
    if (!url) {
      return {
        data: {
          action: input.action,
          output: 'Provide target URL. Example: { "action": "read_page", "target": "https://example.com" }',
        },
      }
    }

    if (input.action === 'open_url' && hasBunWebView()) {
      return {
        data: {
          action: input.action,
          output: [
            `Bun WebView is available on this host.`,
            `Open ${url} in the WebBrowser panel (footer) or use Chrome MCP for interactive control.`,
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
          'For interactive pages: BrowserUse (BROWSER_USE_API_KEY) or Playwright/Chrome MCP.',
          getPlaywrightMcpHint(),
        ].join('\n\n'),
      },
    }
  },
})
