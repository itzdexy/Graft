import { afterEach, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runWithCwdOverride } from '../../../utils/cwd.js'
import { getEditsSinceVerify, noteCodeEditForVerify, resetVerifyEditCounter } from './editHook.js'
import { runGraftAutoVerifyIfNeeded } from './autoVerifyLoop.js'
import { agentPrompt } from '../agent/prompts.js'

const roots: string[] = []
const previous = process.env.GRAFT_AUTO_VERIFY
function fixture() {
  process.env.GRAFT_AUTO_VERIFY = '1'
  const root = mkdtempSync(join(tmpdir(), 'graft visible verify '))
  roots.push(root)
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { test: 'node -e "require(\'fs\').writeFileSync(\'executed\',\'yes\')"' } }))
  return root
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    runWithCwdOverride(root, () => { resetVerifyEditCounter(); resetVerifyEditCounter('worker') })
    rmSync(root, { recursive: true, force: true })
  }
  if (previous === undefined) delete process.env.GRAFT_AUTO_VERIFY
  else process.env.GRAFT_AUTO_VERIFY = previous
})

test('post-edit verification requests shell work without secretly executing package scripts', async () => {
  const root = fixture()
  await runWithCwdOverride(root, async () => {
    noteCodeEditForVerify()
    const result = await runGraftAutoVerifyIfNeeded('default')
    expect(result.kind).toBe('requested')
    if (result.kind !== 'requested') throw new Error('Expected verification request')
    expect(result.feedback).toContain('normal shell tool')
    expect(result.feedback).toContain('cancellation')
    expect(result.feedback).toContain('Do not stage or commit changes automatically')
    expect(result.feedback).toContain('reuse its actual tool result')
    expect(existsSync(join(root, 'executed'))).toBe(false)
    expect((await runGraftAutoVerifyIfNeeded('default')).kind).toBe('skip')
  })
})

test('pending verification is isolated by project and agent and respects plan mode', async () => {
  const first = fixture()
  const second = fixture()
  runWithCwdOverride(first, () => noteCodeEditForVerify('worker'))
  await runWithCwdOverride(second, async () => expect((await runGraftAutoVerifyIfNeeded('default', 'worker')).kind).toBe('skip'))
  await runWithCwdOverride(first, async () => {
    expect(getEditsSinceVerify()).toBe(0)
    expect((await runGraftAutoVerifyIfNeeded('default')).kind).toBe('skip')
    expect((await runGraftAutoVerifyIfNeeded('plan', 'worker')).kind).toBe('skip')
    expect((await runGraftAutoVerifyIfNeeded('default', 'worker')).kind).toBe('requested')
    expect(getEditsSinceVerify('worker')).toBe(0)
  })
})

test('agent autofix prepares visible verification instead of running scripts during command loading', async () => {
  const root = fixture()
  const blocks = await runWithCwdOverride(root, () => agentPrompt(root, 'autofix fix the fixture'))
  const text = blocks.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n')
  expect(text).toContain('npm run test')
  expect(text).toContain('Verification has not run for this request')
  expect(text).toContain('normal shell tool')
  expect(existsSync(join(root, 'executed'))).toBe(false)
})
