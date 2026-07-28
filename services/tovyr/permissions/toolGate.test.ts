import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { dirname, join } from 'node:path'
import { getCwd } from '../../../utils/cwd.js'
import { setTovyrSafeShellBlocked } from '../modes.js'
import { getTovyrTierToolBlock } from './toolGate.js'

describe('toolGate', () => {
  const prevTovyr = process.env.TOVYR_SRC

  beforeEach(() => {
    process.env.TOVYR_SRC = '1'
    setTovyrSafeShellBlocked(false)
  })

  afterEach(() => {
    setTovyrSafeShellBlocked(false)
    if (prevTovyr === undefined) delete process.env.TOVYR_SRC
    else process.env.TOVYR_SRC = prevTovyr
  })

  test('blocks edits in plan mode', () => {
    const block = getTovyrTierToolBlock('Edit', 'plan', { file_path: 'a.ts' })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('/code')
  })

  test('allows read tools in plan mode', () => {
    expect(getTovyrTierToolBlock('Read', 'plan')).toBeNull()
    expect(getTovyrTierToolBlock('Grep', 'plan')).toBeNull()
  })

  test('auto-allows Write in ask (default) mode', () => {
    const block = getTovyrTierToolBlock('Write', 'default', {
      file_path: 'index.html',
      content: '<html></html>',
    })
    expect(block?.behavior).toBe('allow')
    expect(block?.updatedInput?.file_path).toBe(join(getCwd(), 'index.html'))
  })

  test('auto-allows Write in code mode', () => {
    const block = getTovyrTierToolBlock('Write', 'acceptEdits', {
      file_path: 'index.html',
      content: '<html></html>',
    })
    expect(block?.behavior).toBe('allow')
    expect(block?.updatedInput?.file_path).toBe(join(getCwd(), 'index.html'))
  })

  test('defers outside-workspace writes to the stock permission gate', () => {
    const block = getTovyrTierToolBlock('Write', 'acceptEdits', {
      file_path: join(dirname(getCwd()), 'outside.txt'),
      content: 'no implicit approval',
    })
    expect(block).toBeNull()
  })

  test('does not auto-allow a write with no target path', () => {
    expect(
      getTovyrTierToolBlock('Write', 'acceptEdits', {
        content: 'missing target',
      }),
    ).toBeNull()
  })

  test('canonicalizes the tool-specific path key without changing its schema', () => {
    const block = getTovyrTierToolBlock('NotebookEdit', 'acceptEdits', {
      notebook_path: 'notes.ipynb',
    })
    expect(block?.behavior).toBe('allow')
    expect(block?.updatedInput?.notebook_path).toBe(
      join(getCwd(), 'notes.ipynb'),
    )
    expect(block?.updatedInput?.file_path).toBeUndefined()
  })

  test('blocks file-creation shell in auto-edit mode', () => {
    const block = getTovyrTierToolBlock('Bash', 'acceptEdits', {
      command: 'touch index.html',
    })
    expect(block?.behavior).toBe('deny')
    expect(block?.message).toContain('Write')
  })

  test('auto-allows allowlisted shell in ask mode', () => {
    const block = getTovyrTierToolBlock('Bash', 'default', {
      command: 'gh repo view apache/ossie',
    })
    expect(block?.behavior).toBe('allow')
  })

  test('auto-allows allowlisted shell in code mode', () => {
    const block = getTovyrTierToolBlock('Bash', 'acceptEdits', {
      command: 'npm test',
    })
    expect(block?.behavior).toBe('allow')
  })

  test('asks for non-allowlisted shell in auto-edit mode', () => {
    const block = getTovyrTierToolBlock('Bash', 'acceptEdits', {
      command: 'sudo apt install foo',
    })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('allowlist')
  })

  test('asks for destructive shell even when allowlisted base', () => {
    const block = getTovyrTierToolBlock('Bash', 'default', {
      command: 'git push --force origin main',
    })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('destructive')
  })

  test('blocks shell entirely in safe mode', () => {
    setTovyrSafeShellBlocked(true)
    const block = getTovyrTierToolBlock('Bash', 'default', {
      command: 'npm test',
    })
    expect(block?.behavior).toBe('deny')
    expect(block?.message).toContain('safe mode')
  })

  test('asks before reading secret paths', () => {
    const block = getTovyrTierToolBlock('Read', 'acceptEdits', {
      file_path: '/project/.env',
    })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('sensitive file')
  })

  test('asks before writing secret paths', () => {
    const block = getTovyrTierToolBlock('Write', 'default', {
      file_path: '/project/.env',
      content: 'SECRET=1',
    })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('sensitive file')
  })
})
