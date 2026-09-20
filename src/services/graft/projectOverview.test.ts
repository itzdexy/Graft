import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getProjectOverview, parseOverviewGitStatus, formatProjectOverview } from './projectOverview.js'

const roots: string[] = []
function fixture() { const root = mkdtempSync(join(tmpdir(), 'graft overview ')); roots.push(root); return root }
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

test('a non-Git project gets useful metadata without executing package scripts', async () => {
  const root = fixture()
  writeFileSync(join(root, 'package.json'), JSON.stringify({ packageManager: 'pnpm@10.0.0', dependencies: { react: '19.0.0' }, devDependencies: { typescript: '5.0.0' }, scripts: { test: 'touch should-not-exist', dev: 'vite' } }))
  writeFileSync(join(root, '.env'), 'PRIVATE_SENTINEL=never-read')
  const overview = await getProjectOverview(root)
  expect(overview.git).toBeNull()
  expect(overview.stack).toEqual(['JavaScript / Node.js', 'TypeScript', 'React'])
  expect(overview.checks).toContain('pnpm run test')
  expect(overview.entries).not.toContain('.env')
  expect(formatProjectOverview(overview)).not.toContain('PRIVATE_SENTINEL')
  expect(existsSync(join(root, 'should-not-exist'))).toBe(false)
})
test('Git status is real and scoped to the inspected folder', async () => {
  const root = fixture()
  execFileSync('git', ['init', '--quiet'], { cwd: root, stdio: 'ignore' })
  writeFileSync(join(root, 'note.md'), 'hello')
  execFileSync('git', ['add', 'note.md'], { cwd: root, stdio: 'ignore' })
  writeFileSync(join(root, 'note.md'), 'changed')
  writeFileSync(join(root, 'new.txt'), 'new')
  const overview = await getProjectOverview(root)
  expect(overview.git?.staged).toBe(1)
  expect(overview.git?.modified).toBe(1)
  expect(overview.git?.untracked).toBe(1)
})
test('rename source paths and conflicts do not corrupt Git counts', () => {
  expect(parseOverviewGitStatus('## main...origin/main\0R  new name\0old name\0UU conflict\0?? file\0')).toEqual({ branch: 'main', staged: 1, modified: 0, untracked: 1, conflicts: 1 })
})
test('malformed manifests and large root listings remain bounded', async () => {
  const root = fixture()
  writeFileSync(join(root, 'package.json'), '{invalid')
  for (let i = 0; i < 30; i++) writeFileSync(join(root, `${i}.txt`), '')
  const overview = await getProjectOverview(root)
  expect(overview.entries).toHaveLength(14)
  expect(overview.truncated).toBe(true)
  expect(overview.checks).toEqual([])
})
