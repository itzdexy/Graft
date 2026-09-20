import { afterEach, describe, expect, test } from 'bun:test'
import {
  isInstalledGraftRuntime,
  parseGitHubCommit,
} from './githubUpdater.js'

describe('Graft GitHub updater', () => {
  const originalPackageRoot = process.env.GRAFT_PACKAGE_ROOT
  const originalSourceRoot = process.env.GRAFT_SRC

  afterEach(() => {
    if (originalPackageRoot === undefined) delete process.env.GRAFT_PACKAGE_ROOT
    else process.env.GRAFT_PACKAGE_ROOT = originalPackageRoot
    if (originalSourceRoot === undefined) delete process.env.GRAFT_SRC
    else process.env.GRAFT_SRC = originalSourceRoot
  })

  test('recognizes only installed versioned runtimes', () => {
    expect(
      isInstalledGraftRuntime(
        'C:\\Users\\Ada\\AppData\\Local\\Graft\\Runtime\\1.0.0',
      ),
    ).toBe(true)
    expect(isInstalledGraftRuntime('C:\\work\\GraftCode')).toBe(false)
    expect(isInstalledGraftRuntime('C:\\Program Files\\Graft')).toBe(false)
  })

  test('sanitizes GitHub commit metadata for the update notice', () => {
    const commit = parseGitHubCommit({
      sha: '0123456789abcdef0123456789abcdef01234567',
      html_url:
        'https://github.com/itzdexy/Graft/commit/0123456789abcdef0123456789abcdef01234567',
      commit: { message: 'Improve streaming updates\n\nInternal details' },
    })
    expect(commit.shortSha).toBe('0123456')
    expect(commit.title).toBe('Improve streaming updates')
  })

  test('rejects an unpinned archive revision', () => {
    expect(() => parseGitHubCommit({ sha: 'main' })).toThrow(
      'invalid Graft revision',
    )
  })
})
