import { describe, expect, test } from 'bun:test'
import { buildRepoIndex } from './indexer.js'
import { buildRankedRepoMap } from './repoMap.js'

describe('repoMap', () => {
  test('topic matches outrank a large unrelated file', () => {
    const index = buildRepoIndex('/proj', ['src/util.ts', 'src/auth.ts'], rel => rel === 'src/auth.ts' ? 'export function authenticate() {}' : Array.from({ length: 150 }, (_, i) => `export function util${i}() {}`).join('\n'))
    const map = buildRankedRepoMap(index, { query: 'auth', maxChars: 240 })
    expect(map).toContain('src/auth.ts')
    expect(map).toContain('authenticate')
    expect(map.length).toBeLessThanOrEqual(240)
    expect(buildRankedRepoMap(index, { maxChars: 0 })).toBe('')
  })
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
