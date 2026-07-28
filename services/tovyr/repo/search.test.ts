import { describe, expect, test } from 'bun:test'
import { buildRepoIndex } from './indexer.js'
import { searchSymbols, searchFiles } from './search.js'

const sampleFiles = ['src/utils/foo.ts', 'src/components/Bar.tsx']

const fileContents: Record<string, string> = {
  'src/utils/foo.ts': `
export function helper() { return 1 }
export class FooUtil {}
import { bar } from '../components/Bar'
`,
  'src/components/Bar.tsx': `
export function bar() {}
export type BarProps = { id: string }
`,
}

describe('repo indexer', () => {
  test('buildRepoIndex extracts symbols and imports', () => {
    const index = buildRepoIndex('/proj', sampleFiles, rel => fileContents[rel] ?? null)
    expect(index.symbols.some(s => s.name === 'helper')).toBe(true)
    expect(index.symbols.some(s => s.name === 'FooUtil')).toBe(true)
    expect(index.imports.some(i => i.from.includes('foo'))).toBe(true)
  })

  test('searchSymbols finds by name', () => {
    const index = buildRepoIndex('/proj', sampleFiles, rel => fileContents[rel] ?? null)
    const hits = searchSymbols(index, 'bar')
    expect(hits.some(s => s.name === 'bar')).toBe(true)
  })

  test('searchFiles finds by path', () => {
    const index = buildRepoIndex('/proj', sampleFiles, rel => fileContents[rel] ?? null)
    const files = searchFiles(index, 'utils')
    expect(files.some(f => f.includes('foo'))).toBe(true)
  })
})
