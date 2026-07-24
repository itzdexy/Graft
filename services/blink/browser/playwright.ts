/** Playwright MCP guidance (Phase 11). */

export const PLAYWRIGHT_MCP_SERVER_NAME = 'playwright'

export function getPlaywrightMcpHint(): string {
  return [
    '# Playwright MCP (optional)',
    '',
    'Add a Playwright MCP server for tab management, form fill, screenshots, and PDF extraction.',
    '',
    'Example (`~/.blink/mcp.json` or project MCP config):',
    '```json',
    '{',
    '  "mcpServers": {',
    '    "playwright": {',
    '      "command": "npx",',
    '      "args": ["-y", "@playwright/mcp@latest"]',
    '    }',
    '  }',
    '}',
    '```',
    '',
    'Then use `/mcp` to connect and call browser_* tools from the Playwright server.',
    'Blink maps interactive actions in `services/blink/browser/registry.ts`.',
  ].join('\n')
}

export function isPlaywrightMcpConfigured(mcpServerNames: string[]): boolean {
  return mcpServerNames.some(
    n => n.toLowerCase().includes('playwright'),
  )
}
