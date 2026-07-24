import { describe, expect, test } from 'bun:test'
import { isShellAllowlisted, shellCommandBase } from './shellAllowlist.js'

describe('shellAllowlist', () => {
  test('extracts command base', () => {
    expect(shellCommandBase('npm test')).toBe('npm')
    expect(shellCommandBase('npx vitest run')).toBe('npx')
  })

  test('allowlists dev commands', () => {
    expect(isShellAllowlisted('bun test')).toBe(true)
    expect(isShellAllowlisted('git status')).toBe(true)
    expect(isShellAllowlisted('curl https://example.com')).toBe(false)
  })
})
