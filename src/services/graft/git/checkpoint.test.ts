import { afterEach, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commitGraftChanges, isGitRepo, previewLastGraftCommit, undoLastGraftCommit } from './checkpoint.js'
import undo from '../../../commands/graft/undo.js'
import { runWithCwdOverride } from '../../../utils/cwd.js'

const roots: string[] = []
function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'graft git workflow '))
  roots.push(root)
  git(root, 'init', '--quiet')
  git(root, 'config', 'user.name', 'Graft Fixture')
  git(root, 'config', 'user.email', 'fixture@example.invalid')
  git(root, 'config', 'commit.gpgsign', 'false')
  git(root, 'config', 'core.autocrlf', 'false')
  git(root, 'config', 'core.hooksPath', join(root, 'no-hooks'))
  writeFileSync(join(root, 'code.txt'), 'before\n')
  git(root, 'add', 'code.txt')
  git(root, 'commit', '-qm', 'Initial fixture')
  return root
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

test('explicit commit preserves unstaged and untracked work', async () => {
  const root = fixture()
  expect(await isGitRepo(root)).toBe(true)
  writeFileSync(join(root, 'code.txt'), 'selected\n')
  git(root, 'add', 'code.txt')
  writeFileSync(join(root, 'code.txt'), 'later user edit\n')
  writeFileSync(join(root, 'private-note.txt'), 'keep local\n')
  const result = await commitGraftChanges(root, 'selected fix')
  expect(result.ok).toBe(true)
  expect(git(root, 'show', 'HEAD:code.txt')).toBe('selected')
  expect(readFileSync(join(root, 'code.txt'), 'utf8')).toBe('later user edit\n')
  expect(git(root, 'ls-tree', '--name-only', 'HEAD')).not.toContain('private-note')
  expect(git(root, 'status', '--porcelain')).toContain('?? private-note.txt')
})

test('an unstaged-only commit request does not stage or commit anything', async () => {
  const root = fixture()
  const head = git(root, 'rev-parse', 'HEAD')
  writeFileSync(join(root, 'code.txt'), 'user edit\n')
  expect((await commitGraftChanges(root, 'nothing selected')).ok).toBe(false)
  expect(git(root, 'rev-parse', 'HEAD')).toBe(head)
  expect(git(root, 'diff', '--cached')).toBe('')
})

test('Git undo previews without mutation, then reverts while preserving history', async () => {
  const root = fixture()
  writeFileSync(join(root, 'code.txt'), 'after\n')
  git(root, 'add', 'code.txt')
  expect((await commitGraftChanges(root, 'fix')).ok).toBe(true)
  const head = git(root, 'rev-parse', 'HEAD')
  const preview = await undoLastGraftCommit(root)
  expect(preview.message).toContain('/undo git apply ' + head)
  expect(git(root, 'rev-parse', 'HEAD')).toBe(head)
  expect(readFileSync(join(root, 'code.txt'), 'utf8')).toBe('after\n')
  expect((await undoLastGraftCommit(root, '0'.repeat(40))).ok).toBe(false)
  expect((await undoLastGraftCommit(root, head)).ok).toBe(true)
  expect(readFileSync(join(root, 'code.txt'), 'utf8')).toBe('before\n')
  expect(git(root, 'rev-list', '--count', 'HEAD')).toBe('3')
  expect(git(root, 'rev-parse', 'HEAD^')).toBe(head)
})

test('Git undo refuses pending work and non-Graft commits', async () => {
  const root = fixture()
  expect((await previewLastGraftCommit(root)).ok).toBe(false)
  writeFileSync(join(root, 'code.txt'), 'after\n')
  git(root, 'add', 'code.txt')
  await commitGraftChanges(root, 'fix')
  const head = git(root, 'rev-parse', 'HEAD')
  writeFileSync(join(root, 'user-note.txt'), 'pending\n')
  expect((await undoLastGraftCommit(root, head)).ok).toBe(false)
  expect(git(root, 'rev-parse', 'HEAD')).toBe(head)
  expect(readFileSync(join(root, 'user-note.txt'), 'utf8')).toBe('pending\n')
})

test('undo command loader previews and rejects malformed apply without rewinding the conversation', async () => {
  const root = fixture()
  writeFileSync(join(root, 'code.txt'), 'after\n')
  git(root, 'add', 'code.txt')
  await commitGraftChanges(root, 'fix')
  const head = git(root, 'rev-parse', 'HEAD')
  let rewound = false
  if (undo.type !== 'local') throw new Error('Expected local undo command')
  const loaded = await undo.load()
  const context = { messages: [], restoreUserMessage: () => { rewound = true } } as never
  await runWithCwdOverride(root, async () => {
    const preview = await loaded.call('git', context)
    expect(preview.type === 'text' && preview.value).toContain('/undo git apply ' + head)
    const invalid = await loaded.call('git apply not-a-commit', context)
    expect(invalid.type === 'text' && invalid.value).toContain('Use /undo git to preview')
  })
  expect(rewound).toBe(false)
  expect(git(root, 'rev-parse', 'HEAD')).toBe(head)
})
