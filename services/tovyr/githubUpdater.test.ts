import { afterEach, describe, expect, test } from 'bun:test'
import {
  isInstalledTovyrRuntime,
  parseGitHubCommit,
} from './githubUpdater.js'

describe('Tovyr GitHub updater', () => {
  const originalPackageRoot = process.env.TOVYR_PACKAGE_ROOT
  const originalSourceRoot = process.env.TOVYR_SRC

  afterEach(() => {
    if (originalPackageRoot === undefined) delete process.env.TOVYR_PACKAGE_ROOT
    else process.env.TOVYR_PACKAGE_ROOT = originalPackageRoot
    if (originalSourceRoot === undefined) delete process.env.TOVYR_SRC
    else process.env.TOVYR_SRC = originalSourceRoot
  })

  test('recognizes only installed versioned runtimes', () => {
    expect(
      isInstalledTovyrRuntime(
        'C:\\Users\\Ada\\AppData\\Local\\Tovyr\\Runtime\\1.0.0',
      ),
    ).toBe(true)
    expect(isInstalledTovyrRuntime('C:\\work\\TovyrCode')).toBe(false)
    expect(isInstalledTovyrRuntime('C:\\Program Files\\Tovyr')).toBe(false)
  })

  test('sanitizes GitHub commit metadata for the update notice', () => {
    const commit = parseGitHubCommit({
      sha: '0123456789abcdef0123456789abcdef01234567',
      html_url:
        'https://github.com/itsdexy/Tovyr/commit/0123456789abcdef0123456789abcdef01234567',
      commit: { message: 'Improve streaming updates\n\nInternal details' },
    })
    expect(commit.shortSha).toBe('0123456')
    expect(commit.title).toBe('Improve streaming updates')
  })

  test('rejects an unpinned archive revision', () => {
    expect(() => parseGitHubCommit({ sha: 'main' })).toThrow(
      'invalid Tovyr revision',
    )
  })
})
