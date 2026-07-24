import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { setBlinkSafeShellBlocked } from '../modes.js'
import { getBlinkTierToolBlock } from './toolGate.js'

describe('toolGate', () => {
  const prevBlink = process.env.BLINK_SRC

  beforeEach(() => {
    process.env.BLINK_SRC = '1'
    setBlinkSafeShellBlocked(false)
  })

  afterEach(() => {
    setBlinkSafeShellBlocked(false)
    if (prevBlink === undefined) delete process.env.BLINK_SRC
    else process.env.BLINK_SRC = prevBlink
  })

  test('blocks edits in plan mode', () => {
    const block = getBlinkTierToolBlock('Edit', 'plan', { file_path: 'a.ts' })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('/code')
  })

  test('allows read tools in plan mode', () => {
    expect(getBlinkTierToolBlock('Read', 'plan')).toBeNull()
    expect(getBlinkTierToolBlock('Grep', 'plan')).toBeNull()
  })

  test('auto-allows Write in ask (default) mode', () => {
    const block = getBlinkTierToolBlock('Write', 'default', {
      file_path: 'index.html',
      content: '<html></html>',
    })
    expect(block?.behavior).toBe('allow')
  })

  test('auto-allows Write in code mode', () => {
    const block = getBlinkTierToolBlock('Write', 'acceptEdits', {
      file_path: 'index.html',
      content: '<html></html>',
    })
    expect(block?.behavior).toBe('allow')
  })

  test('blocks file-creation shell in auto-edit mode', () => {
    const block = getBlinkTierToolBlock('Bash', 'acceptEdits', {
      command: 'touch index.html',
    })
    expect(block?.behavior).toBe('deny')
    expect(block?.message).toContain('Write')
  })

  test('auto-allows allowlisted shell in ask mode', () => {
    const block = getBlinkTierToolBlock('Bash', 'default', {
      command: 'gh repo view apache/ossie',
    })
    expect(block?.behavior).toBe('allow')
  })

  test('auto-allows allowlisted shell in code mode', () => {
    const block = getBlinkTierToolBlock('Bash', 'acceptEdits', {
      command: 'npm test',
    })
    expect(block?.behavior).toBe('allow')
  })

  test('asks for non-allowlisted shell in auto-edit mode', () => {
    const block = getBlinkTierToolBlock('Bash', 'acceptEdits', {
      command: 'sudo apt install foo',
    })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('allowlist')
  })

  test('asks for destructive shell even when allowlisted base', () => {
    const block = getBlinkTierToolBlock('Bash', 'default', {
      command: 'git push --force origin main',
    })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('destructive')
  })

  test('blocks shell entirely in safe mode', () => {
    setBlinkSafeShellBlocked(true)
    const block = getBlinkTierToolBlock('Bash', 'default', {
      command: 'npm test',
    })
    expect(block?.behavior).toBe('deny')
    expect(block?.message).toContain('safe mode')
  })

  test('asks before reading secret paths', () => {
    const block = getBlinkTierToolBlock('Read', 'acceptEdits', {
      file_path: '/project/.env',
    })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('sensitive file')
  })

  test('asks before writing secret paths', () => {
    const block = getBlinkTierToolBlock('Write', 'default', {
      file_path: '/project/.env',
      content: 'SECRET=1',
    })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('sensitive file')
  })
})
