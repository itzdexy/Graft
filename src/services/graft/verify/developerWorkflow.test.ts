import { afterEach, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectPackageManager, detectProjectScripts } from './projectScripts.js'
import { verifyPromptForCwd } from './verifyPrompts.js'
import verifyCommand from '../../../commands/graft/verify.js'

const roots: string[] = []
function project(pkg: unknown): string {
  const root = mkdtempSync(join(tmpdir(), 'graft-developer-'))
  roots.push(root)
  writeFileSync(join(root, 'package.json'), JSON.stringify(pkg))
  return root
}
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }) })

test('explicit package manager wins over a stale lockfile', () => {
  const root = project({ packageManager: 'pnpm@10.0.0', scripts: { test: 'vitest run' } })
  writeFileSync(join(root, 'bun.lock'), '')
  expect(detectPackageManager(root)).toBe('pnpm')
  expect(detectProjectScripts(root).checks[0]?.command).toBe('pnpm')
})
test('bare verify prepares checks while explicit help stays help', async () => {
  if (verifyCommand.type !== 'prompt') throw new Error('Expected prompt command')
  const run = await verifyCommand.getPromptForCommand('', {} as never)
  const help = await verifyCommand.getPromptForCommand('help', {} as never)
  expect((run[0] as { text: string }).text).toContain('# Verify this project')
  expect((help[0] as { text: string }).text).toContain('# Graft Verify')
})
test('missing tests and fix-only lint scripts are not invented as checks', () => {
  const root = project({ scripts: { 'lint:fix': 'eslint --fix .', build: '', typecheck: 12 } })
  mkdirSync(join(root, 'node_modules'))
  expect(detectProjectScripts(root).checks).toEqual([])
})
test('verification prepares visible tool work without executing project code during prompt loading', async () => {
  const root = project({ scripts: { test: 'node -e "require(\'fs\').writeFileSync(\'executed\',\'yes\')"' } })
  const blocks = await verifyPromptForCwd(root)
  expect(existsSync(join(root, 'executed'))).toBe(false)
  const text = (blocks[0] as { text: string }).text
  expect(text).toContain('npm run test')
  expect(text).toContain('normal shell tool')
  expect(text).toContain('cancellation')
  expect(text).toContain('does not authorize source changes')
})
test('invalid and absent checks cannot be mistaken for passed verification', async () => {
  const root = project({ scripts: { test: 'vitest run' } })
  const invalid = (await verifyPromptForCwd(root, 'deploy'))[0] as { text: string }
  expect(invalid.text).toContain('Unknown verification kind')
  const missing = (await verifyPromptForCwd(root, 'typecheck'))[0] as { text: string }
  expect(missing.text).toContain('Not configured: typecheck')
  expect(missing.text).toContain('verification was not run')
  expect(missing.text).not.toContain('npm run test')
})
