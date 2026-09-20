/** Browser tool surface for Graft agents (maps to WebFetch, WebSearch, and optional MCP tools). */

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
  graftMapping: string
  requiresMcp?: string
}

export const BROWSER_TOOLS: BrowserToolDef[] = [
  {
    id: 'open_url',
    description: 'Navigate to a URL and load the page',
    graftMapping: 'WebFetch with url',
  },
  {
    id: 'search_web',
    description: 'Search the web for a query',
    graftMapping: 'WebSearch tool',
  },
  {
    id: 'read_page',
    description: 'Read page content as markdown/text',
    graftMapping: 'WebFetch — returns readable content',
  },
  {
    id: 'extract_text',
    description: 'Extract main text from a page',
    graftMapping: 'WebFetch + parse headings/body in prompt',
  },
  {
    id: 'extract_links',
    description: 'List links on a page',
    graftMapping: 'WebFetch then grep markdown links',
  },
  {
    id: 'take_screenshot',
    description: 'Capture a visual screenshot',
    graftMapping: 'Playwright or computer-use MCP when configured',
    requiresMcp: 'browser automation',
  },
  {
    id: 'download_file',
    description: 'Download a file from a URL',
    graftMapping: 'Bash curl/wget or WebFetch for small assets',
  },
  {
    id: 'fill_form',
    description: 'Fill form fields on a page',
    graftMapping: 'Playwright or computer-use MCP',
    requiresMcp: 'browser automation',
  },
  {
    id: 'click_element',
    description: 'Click a DOM element',
    graftMapping: 'Playwright or computer-use MCP',
    requiresMcp: 'browser automation',
  },
  {
    id: 'type_text',
    description: 'Type into focused input',
    graftMapping: 'Playwright or computer-use MCP',
    requiresMcp: 'browser automation',
  },
  {
    id: 'playwright_navigate',
    description: 'Playwright tab navigation and automation',
    graftMapping: 'Playwright MCP (@playwright/mcp)',
    requiresMcp: 'playwright',
  },
]

export function formatBrowserToolCatalog(): string {
  return BROWSER_TOOLS.map(
    t =>
      `- **${t.id}** — ${t.description}\n  → ${t.graftMapping}${t.requiresMcp ? ` (needs ${t.requiresMcp})` : ''}`,
  ).join('\n')
}
