import { describe, expect, test } from 'bun:test'
import { BROWSER_TOOLS, formatBrowserToolCatalog } from './registry.js'

describe('browser registry', () => {
  test('catalog lists every registered tool', () => {
    const catalog = formatBrowserToolCatalog()
    for (const tool of BROWSER_TOOLS) {
      expect(catalog).toContain(tool.id)
      expect(catalog).toContain(tool.description)
      expect(catalog).toContain(tool.blinkMapping)
    }
  })

  test('MCP-required tools are marked in the catalog', () => {
    const catalog = formatBrowserToolCatalog()
    const chromeTools = BROWSER_TOOLS.filter(t => t.requiresMcp === 'chrome')
    expect(chromeTools.length).toBeGreaterThan(0)
    for (const tool of chromeTools) {
      expect(catalog).toContain(`needs ${tool.requiresMcp}`)
    }
  })

  test('tool ids are unique', () => {
    const ids = BROWSER_TOOLS.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})