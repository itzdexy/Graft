import { afterEach, describe, expect, test } from 'bun:test'
import { loadRepoMapSectionSync, warmRepoMapCache } from './repoContext.js'

const envKeys = ['GRAFT_REPO_MAP'] as const

function saveEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {}
  for (const key of envKeys) {
    saved[key] = process.env[key]
  }
  return saved
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const key of envKeys) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
}

describe('loadRepoMapSectionSync', () => {
  const saved = saveEnv()

  afterEach(() => restoreEnv(saved))

  test('returns null when repo map disabled', () => {
    process.env.GRAFT_REPO_MAP = '0'
    expect(loadRepoMapSectionSync('/nonexistent-graft-test-cwd')).toBeNull()
  })
})

describe('warmRepoMapCache', () => {
  const saved = saveEnv()

  afterEach(() => restoreEnv(saved))

  test('no-op when repo map disabled', () => {
    process.env.GRAFT_REPO_MAP = '0'
    expect(() => warmRepoMapCache('/nonexistent-graft-test-cwd')).not.toThrow()
  })
})