import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { loadGitDiffSectionSync } from './gitDiffContext.js'

function git(cwd: string, ...args: string[]) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || 'git failed')
  }
}

describe('loadGitDiffSectionSync', () => {
  test('returns null outside a git repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'graft-nogit-'))
    try {
      expect(loadGitDiffSectionSync(dir)).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test('lists changed files in a repo', () => {
    const prev = process.env.GRAFT_SRC
    process.env.GRAFT_SRC = process.cwd()
    const dir = mkdtempSync(join(tmpdir(), 'graft-git-'))
    try {
      git(dir, 'init')
      git(dir, 'config', 'user.email', 'test@example.com')
      git(dir, 'config', 'user.name', 'Test')
      writeFileSync(join(dir, 'README.md'), '# hi\n')
      git(dir, 'add', 'README.md')
      git(dir, 'commit', '-m', 'init')
      writeFileSync(join(dir, 'README.md'), '# hi\nchanged\n')
      const section = loadGitDiffSectionSync(dir)
      expect(section).toContain('Git working tree')
      expect(section).toContain('README.md')
    } finally {
      if (prev === undefined) delete process.env.GRAFT_SRC
      else process.env.GRAFT_SRC = prev
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
