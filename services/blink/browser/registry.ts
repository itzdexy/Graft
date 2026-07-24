/** Browser tool surface for Blink agents (maps to WebFetch, WebSearch, Chrome MCP). */

export type BrowserToolId =
  | 'open_url'
  | 'search_web'
  | 'read_page'
  | 'extract_text'
  | 'extract_links'
  | 'take_screenshot'
  | 'download_file'
  | 'fill_form'
  | 'click_element'
  | 'type_text'
  | 'playwright_navigate'

export type BrowserToolDef = {
  id: BrowserToolId
  description: string
  blinkMapping: string
  requiresMcp?: string
}

export const BROWSER_TOOLS: BrowserToolDef[] = [
  {
    id: 'open_url',
    description: 'Navigate to a URL and load the page',
    blinkMapping: 'WebFetch with url',
  },
  {
    id: 'search_web',
    description: 'Search the web for a query',
    blinkMapping: 'WebSearch tool',
  },
  {
    id: 'read_page',
    description: 'Read page content as markdown/text',
    blinkMapping: 'WebFetch — returns readable content',
  },
  {
    id: 'extract_text',
    description: 'Extract main text from a page',
    blinkMapping: 'WebFetch + parse headings/body in prompt',
  },
  {
    id: 'extract_links',
    description: 'List links on a page',
    blinkMapping: 'WebFetch then grep markdown links',
  },
  {
    id: 'take_screenshot',
    description: 'Capture a visual screenshot',
    blinkMapping: '/chrome MCP or computer-use when configured',
    requiresMcp: 'chrome',
  },
  {
    id: 'download_file',
    description: 'Download a file from a URL',
    blinkMapping: 'Bash curl/wget or WebFetch for small assets',
  },
  {
    id: 'fill_form',
    description: 'Fill form fields on a page',
    blinkMapping: 'Chrome/computer-use MCP',
    requiresMcp: 'chrome',
  },
  {
    id: 'click_element',
    description: 'Click a DOM element',
    blinkMapping: 'Chrome/computer-use MCP',
    requiresMcp: 'chrome',
  },
  {
    id: 'type_text',
    description: 'Type into focused input',
    blinkMapping: 'Chrome/computer-use MCP',
    requiresMcp: 'chrome',
  },
  {
    id: 'playwright_navigate',
    description: 'Playwright tab navigation and automation',
    blinkMapping: 'Playwright MCP (@playwright/mcp)',
    requiresMcp: 'playwright',
  },
]

export function formatBrowserToolCatalog(): string {
  return BROWSER_TOOLS.map(
    t =>
      `- **${t.id}** — ${t.description}\n  → ${t.blinkMapping}${t.requiresMcp ? ` (needs ${t.requiresMcp})` : ''}`,
  ).join('\n')
}
