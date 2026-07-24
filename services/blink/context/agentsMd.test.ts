import { describe, expect, test } from 'bun:test'
import { existsSync } from 'fs'
import { join } from 'path'
import { findGitRoot } from './agentsMd.js'

describe('findGitRoot', () => {
  test('finds git root from cwd in this repository', () => {
    const root = findGitRoot(process.cwd())
    expect(root).not.toBeNull()
    expect(existsSync(join(root!, '.git'))).toBe(true)
  })

  test('returns null when no .git in ancestry', () => {
    const root = findGitRoot('C:\\')
    if (process.platform === 'win32') {
      expect(root).toBeNull()
    }
  })
})