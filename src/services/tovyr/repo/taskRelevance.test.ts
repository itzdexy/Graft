import { describe, expect, test } from 'bun:test'
import { buildTaskProjectMap } from './taskRelevance.js'
import type { RepoIndex } from './types.js'

function makeIndex(): RepoIndex {
  return {
    cwd: '/proj',
    indexedAt: Date.now(),
    files: [
      'src/routes/auth.ts',
      'src/middleware/rate-limit.ts',
      'src/lib/redis.ts',
      'src/lib/logger.ts',
      'tests/auth.test.ts',
    ],
    symbols: [
      { name: 'login', kind: 'function', file: 'src/routes/auth.ts', line: 1 },
      { name: 'authLimiter', kind: 'const', file: 'src/middleware/rate-limit.ts', line: 1 },
      { name: 'tokenBucket', kind: 'function', file: 'src/lib/redis.ts', line: 1 },
    ],
    imports: [
      { from: 'src/middleware/rate-limit.ts', to: '../lib/redis', line: 1 },
      { from: 'src/routes/auth.ts', to: '../middleware/rate-limit', line: 2 },
      { from: 'tests/auth.test.ts', to: '../src/routes/auth', line: 1 },
    ],
  }
}

describe('buildTaskProjectMap', () => {
  test('highlights auth-related files and rate-limit → redis edge', () => {
    const map = buildTaskProjectMap(makeIndex(), {
      query: 'auth rate limit redis',
      maxFiles: 10,
    })

    expect(map.indexed).toBe(true)
    expect(map.relevantPaths).toContain('src/middleware/rate-limit.ts')
    expect(map.relevantPaths).toContain('src/lib/redis.ts')
    expect(map.edges.some(e => e.from.includes('rate-limit') && e.to.includes('redis'))).toBe(
      true,
    )
  })

  test('returns empty indexed=false without index', () => {
    const map = buildTaskProjectMap(null, { query: 'auth' })
    expect(map.indexed).toBe(false)
    expect(map.tree).toEqual([])
  })
})
