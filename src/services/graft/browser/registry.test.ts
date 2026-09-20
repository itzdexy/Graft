import { describe, expect, test } from 'bun:test'
import { BROWSER_TOOLS, formatBrowserToolCatalog } from './registry.js'

describe('browser registry', () => {
  test('catalog lists every registered tool', () => {
    const catalog = formatBrowserToolCatalog()
    for (const tool of BROWSER_TOOLS) {
      expect(catalog).toContain(tool.id)
      expect(catalog).toContain(tool.description)
      expect(catalog).toContain(tool.graftMapping)
    }
  })

  test('MCP-required tools are marked in the catalog', () => {
    const catalog = formatBrowserToolCatalog()
    const automatedTools = BROWSER_TOOLS.filter(t => Boolean(t.requiresMcp))
    expect(automatedTools.length).toBeGreaterThan(0)
    for (const tool of automatedTools) {
      expect(catalog).toContain(`needs ${tool.requiresMcp}`)
    }
  })

  test('tool ids are unique', () => {
    const ids = BROWSER_TOOLS.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
