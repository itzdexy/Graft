import { describe, expect, test } from 'bun:test'
import type { GraftProjectMemory } from './memory.js'
import {
  clearMemorySearchCache,
  searchProjectMemoryCached,
} from './memoryCache.js'

const memory: GraftProjectMemory = {
  projectName: 'demo',
  goals: ['use React'],
  architecture: ['monorepo'],
  decisions: ['pick bun'],
  roadmap: [],
  codingStandards: [],
  updatedAt: Date.now(),
}

describe('memoryCache', () => {
  test('caches search results', () => {
    clearMemorySearchCache('/tmp/proj')
    const a = searchProjectMemoryCached('/tmp/proj', memory, 'react', 5)
    const b = searchProjectMemoryCached('/tmp/proj', memory, 'react', 5)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
  })

  test('clear by cwd drops cache', () => {
    clearMemorySearchCache('/tmp/other')
    searchProjectMemoryCached('/tmp/other', memory, 'bun', 5)
    clearMemorySearchCache('/tmp/other')
    const after = searchProjectMemoryCached('/tmp/other', memory, 'bun', 5)
    expect(after.length).toBeGreaterThan(0)
  })

  test('a changed memory version invalidates stale cached results', () => {
    clearMemorySearchCache('/tmp/ver')
    const v1: GraftProjectMemory = {
      projectName: 'v',
      goals: ['use React'],
      architecture: [],
      decisions: [],
      roadmap: [],
      codingStandards: [],
      updatedAt: 1,
    }
    expect(searchProjectMemoryCached('/tmp/ver', v1, 'react', 5)).toHaveLength(1)

    // Memory edited (new content + bumped updatedAt). The same query must NOT
    // return the stale "use React" hit.
    const v2: GraftProjectMemory = { ...v1, goals: ['use Vue'], updatedAt: 2 }
    expect(searchProjectMemoryCached('/tmp/ver', v2, 'react', 5)).toHaveLength(0)
    expect(searchProjectMemoryCached('/tmp/ver', v2, 'vue', 5)).toHaveLength(1)
  })
})
