import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  addObservations,
  createEntities,
  createRelations,
  openKnowledgeNodes,
  readKnowledgeGraph,
  searchKnowledgeGraph,
} from '../memory/graph.js'
import {
  recordSequentialThought,
  formatSequentialThoughtToolResult,
} from '../mcp/sequentialThinking.js'
import {
  getMcpTemplate,
  listMcpTemplateIds,
  templateToMcpConfig,
  wrapCommandForPlatform,
} from '../mcp/multilang/index.js'
import {
  isTovyrBuiltinMcpServer,
  TOVYR_MEMORY_GRAPH_SERVER_NAME,
} from '../mcp/builtin/names.js'
import { getTovyrBuiltinMcpServerConfigs } from '../mcp/builtin/configs.js'

describe('memory knowledge graph MCP API', () => {
  test('createEntities and search_nodes semantics', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tovyr-graph-'))
    try {
      createEntities(dir, [
        { name: 'Tovyr', entityType: 'project', observations: ['CLI agent'] },
      ])
      createRelations(dir, [
        { from: 'Tovyr', to: 'MCP', relationType: 'uses' },
      ])
      addObservations(dir, [
        { entityName: 'Tovyr', contents: ['OpenCode-style UI'] },
      ])
      const search = searchKnowledgeGraph(dir, 'CLI')
      expect(search.entities.some(e => e.name === 'Tovyr')).toBe(true)
      const open = openKnowledgeNodes(dir, ['Tovyr'])
      expect(open.entities[0]?.observations).toContain('OpenCode-style UI')
      const full = readKnowledgeGraph(dir)
      expect(full.relations.some(r => r.to === 'MCP')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('sequential thinking MCP API', () => {
  test('recordSequentialThought tracks steps', () => {
    const r1 = recordSequentialThought({
      thought: 'Break down the problem',
      thoughtNumber: 1,
      totalThoughts: 3,
      nextThoughtNeeded: true,
    })
    expect(r1.thoughtNumber).toBe(1)
    expect(r1.nextThoughtNeeded).toBe(true)

    const text = formatSequentialThoughtToolResult({
      thought: 'Final step',
      thoughtNumber: 2,
      totalThoughts: 2,
      nextThoughtNeeded: false,
    })
    expect(text).toContain('Final step')
  })
})

describe('multilang MCP templates', () => {
  test('lists builtin and external templates', () => {
    const ids = listMcpTemplateIds()
    expect(ids).toContain('tovyr-memory')
    expect(ids).toContain('stagehand')
    expect(ids).toContain('sequential-thinking')
  })

  test('wrapCommandForPlatform on Windows uses cmd', () => {
    const spec = getMcpTemplate('memory')!
    const wrapped = wrapCommandForPlatform(spec)
    if (process.platform === 'win32') {
      expect(wrapped.command).toBe('cmd')
      expect(wrapped.args[0]).toBe('/c')
    } else {
      expect(wrapped.command).toBe('npx')
    }
  })

  test('templateToMcpConfig for tovyr builtin', () => {
    const cfg = templateToMcpConfig(getMcpTemplate('tovyr-memory')!)
    expect(cfg.env?.TOVYR_BUILTIN_MCP).toBe('memory-graph')
  })

  test('getTovyrBuiltinMcpServerConfigs includes memory server name', () => {
    const prev = process.env.TOVYR_SRC
    process.env.TOVYR_SRC = '1'
    const configs = getTovyrBuiltinMcpServerConfigs()
    if (prev === undefined) delete process.env.TOVYR_SRC
    else process.env.TOVYR_SRC = prev
    expect(configs[TOVYR_MEMORY_GRAPH_SERVER_NAME]).toBeDefined()
  })

  test('isTovyrBuiltinMcpServer recognizes reserved names', () => {
    expect(isTovyrBuiltinMcpServer('tovyr-memory')).toBe(true)
    expect(isTovyrBuiltinMcpServer('slack')).toBe(false)
  })
})
