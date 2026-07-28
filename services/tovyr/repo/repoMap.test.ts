import { describe, expect, test } from 'bun:test'
import { buildRepoIndex } from './indexer.js'
import { buildRankedRepoMap } from './repoMap.js'

describe('repoMap', () => {
  test('includes ranked symbols within budget', () => {
    const index = buildRepoIndex('/proj', ['src/a.ts', 'src/b.ts'], rel => {
      if (rel === 'src/a.ts') {
        return 'export function alpha() {}\nexport class Beta {}'
      }
      if (rel === 'src/b.ts') return 'export function gamma() {}'
      return null
    })
    const map = buildRankedRepoMap(index, { maxChars: 2000 })
    expect(map).toContain('src/a.ts')
    expect(map).toContain('alpha')
    expect(map).toContain('Beta')
  })
})
