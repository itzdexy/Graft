import { describe, expect, test } from 'bun:test'
import type { RepoIndex } from './types.js'
import {
  REPO_INDEX_CACHE_TTL_MS,
  isRepoIndexCacheFresh,
  repoIndexCachePath,
} from './cache.js'

function sampleIndex(overrides: Partial<RepoIndex> = {}): RepoIndex {
  return {
    cwd: '/proj',
    files: ['a.ts'],
    symbols: [],
    imports: [],
    indexedAt: Date.now(),
    ...overrides,
  }
}

describe('repo index cache', () => {
  test('rejects cache when cwd differs', () => {
    const index = sampleIndex({ cwd: '/other' })
    expect(isRepoIndexCacheFresh(index, '/proj')).toBe(false)
  })

  test('rejects cache past TTL', () => {
    const index = sampleIndex({
      indexedAt: Date.now() - REPO_INDEX_CACHE_TTL_MS - 1,
    })
    expect(isRepoIndexCacheFresh(index, '/proj')).toBe(false)
  })

  test('accepts fresh cache within TTL without gitHead', () => {
    const now = Date.now()
    const index = sampleIndex({ indexedAt: now - 1000 })
    expect(isRepoIndexCacheFresh(index, '/proj', { now })).toBe(true)
  })

  test('rejects cache when gitHead no longer matches', () => {
    const now = Date.now()
    const index = sampleIndex({
      indexedAt: now - 1000,
      gitHead: 'abc123def456',
    })
    expect(
      isRepoIndexCacheFresh(index, '/proj', {
        now,
        gitHead: 'fff999eee888',
      }),
    ).toBe(false)
  })

  test('accepts cache when gitHead still matches', () => {
    const now = Date.now()
    const sha = 'abc123def4567890abcd1234567890abcd1234'
    const index = sampleIndex({
      indexedAt: now - 1000,
      gitHead: sha,
    })
    expect(
      isRepoIndexCacheFresh(index, '/proj', { now, gitHead: sha }),
    ).toBe(true)
  })

  test('legacy cache without gitHead ignores HEAD drift', () => {
    const now = Date.now()
    const index = sampleIndex({ indexedAt: now - 1000 })
    expect(
      isRepoIndexCacheFresh(index, '/proj', {
        now,
        gitHead: 'any-sha',
      }),
    ).toBe(true)
  })

  test('cache paths differ for cwds that share a sanitized suffix', () => {
    const suffix = 'x'.repeat(50)
    const a = `/users/alice/${suffix}/project-a`
    const b = `/users/bob/${suffix}/project-b`
    expect(repoIndexCachePath(a)).not.toBe(repoIndexCachePath(b))
  })
})