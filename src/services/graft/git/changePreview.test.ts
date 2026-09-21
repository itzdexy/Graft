import { afterEach, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getChangePreview } from './changePreview.js'
import changes from '../../../commands/graft/changes.js'
import { runWithCwdOverride } from '../../../utils/cwd.js'

const roots: string[] = []
function fixture() { const root = mkdtempSync(join(tmpdir(), 'graft changes ')); roots.push(root); return root }
function git(cwd: string, ...args: string[]) { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

test('changes command reports staged, unstaged, binary, and untracked data without mutating files or index', async () => {
  const root = fixture()
  git(root, 'init', '--quiet')
  git(root, 'config', 'core.autocrlf', 'false')
  writeFileSync(join(root, 'with spaces.txt'), 'selected\n')
  writeFileSync(join(root, 'binary.bin'), Buffer.from([0, 1, 2, 0]))
  git(root, 'add', 'with spaces.txt', 'binary.bin')
  writeFileSync(join(root, 'with spaces.txt'), 'selected\nworking\n')
  writeFileSync(join(root, 'untracked.txt'), 'private body should not appear')
  const before = git(root, 'diff', '--cached', '--binary')
  let output = ''
  await runWithCwdOverride(root, async () => (await changes.load()).call(text => { output = text ?? '' }, {} as never))
  expect(output).toContain('"with spaces.txt"  staged: +1/-0  working: +1/-0')
  expect(output).toContain('"binary.bin"  staged: binary')
  expect(output).toContain('??  "untracked.txt"')
  expect(output).not.toContain('private body')
  expect(git(root, 'diff', '--cached', '--binary')).toBe(before)
  expect(readFileSync(join(root, 'with spaces.txt'), 'utf8')).toBe('selected\nworking\n')
})

test('changes handles a non-repository and bounds large listings', async () => {
  const root = fixture()
  expect(await getChangePreview(root)).toContain('No Git working tree')
  git(root, 'init', '--quiet')
  expect(await getChangePreview(root)).toContain('Working tree clean')
  for (let i = 0; i < 45; i++) writeFileSync(join(root, `file-${i}.txt`), '')
  const output = await getChangePreview(root)
  expect(output).toContain('45 entries')
  expect(output).toContain('5 more entries')
})
