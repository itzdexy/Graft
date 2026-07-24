import { afterEach, describe, expect, test } from 'bun:test'
import {
  isInstalledBlinkRuntime,
  parseGitHubCommit,
} from './githubUpdater.js'

describe('Blink GitHub updater', () => {
  const originalPackageRoot = process.env.BLINK_PACKAGE_ROOT
  const originalSourceRoot = process.env.BLINK_SRC

  afterEach(() => {
    if (originalPackageRoot === undefined) delete process.env.BLINK_PACKAGE_ROOT
    else process.env.BLINK_PACKAGE_ROOT = originalPackageRoot
    if (originalSourceRoot === undefined) delete process.env.BLINK_SRC
    else process.env.BLINK_SRC = originalSourceRoot
  })

  test('recognizes only installed versioned runtimes', () => {
    expect(
      isInstalledBlinkRuntime(
        'C:\\Users\\Ada\\AppData\\Local\\Blink\\Runtime\\1.0.0',
      ),
    ).toBe(true)
    expect(isInstalledBlinkRuntime('C:\\work\\BlinkCode')).toBe(false)
    expect(isInstalledBlinkRuntime('C:\\Program Files\\Blink')).toBe(false)
  })

  test('sanitizes GitHub commit metadata for the update notice', () => {
    const commit = parseGitHubCommit({
      sha: '0123456789abcdef0123456789abcdef01234567',
      html_url:
        'https://github.com/itsdexy/BlinkCode/commit/0123456789abcdef0123456789abcdef01234567',
      commit: { message: 'Improve streaming updates\n\nInternal details' },
    })
    expect(commit.shortSha).toBe('0123456')
    expect(commit.title).toBe('Improve streaming updates')
  })

  test('rejects an unpinned archive revision', () => {
    expect(() => parseGitHubCommit({ sha: 'main' })).toThrow(
      'invalid Blink revision',
    )
  })
})
