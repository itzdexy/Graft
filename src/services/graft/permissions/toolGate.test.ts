import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { dirname, join } from 'node:path'
import { getCwd } from '../../../utils/cwd.js'
import { setGraftSafeShellBlocked } from '../modes.js'
import { getGraftTierToolBlock } from './toolGate.js'

describe('toolGate', () => {
  const prevGraft = process.env.GRAFT_SRC

  beforeEach(() => {
    process.env.GRAFT_SRC = '1'
    setGraftSafeShellBlocked(false)
  })

  afterEach(() => {
    setGraftSafeShellBlocked(false)
    if (prevGraft === undefined) delete process.env.GRAFT_SRC
    else process.env.GRAFT_SRC = prevGraft
  })

  test('blocks edits in plan mode', () => {
    const block = getGraftTierToolBlock('Edit', 'plan', { file_path: 'a.ts' })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('/code')
  })

  test('allows read tools in plan mode', () => {
    expect(getGraftTierToolBlock('Read', 'plan')).toBeNull()
    expect(getGraftTierToolBlock('Grep', 'plan')).toBeNull()
  })

  test('auto-allows Write in ask (default) mode', () => {
    const block = getGraftTierToolBlock('Write', 'default', {
      file_path: 'index.html',
      content: '<html></html>',
    })
    expect(block?.behavior).toBe('allow')
    expect(block?.updatedInput?.file_path).toBe(join(getCwd(), 'index.html'))
  })

  test('auto-allows Write in code mode', () => {
    const block = getGraftTierToolBlock('Write', 'acceptEdits', {
      file_path: 'index.html',
      content: '<html></html>',
    })
    expect(block?.behavior).toBe('allow')
    expect(block?.updatedInput?.file_path).toBe(join(getCwd(), 'index.html'))
  })

  test('defers outside-workspace writes to the stock permission gate', () => {
    const block = getGraftTierToolBlock('Write', 'acceptEdits', {
      file_path: join(dirname(getCwd()), 'outside.txt'),
      content: 'no implicit approval',
    })
    expect(block).toBeNull()
  })

  test('does not auto-allow a write with no target path', () => {
    expect(
      getGraftTierToolBlock('Write', 'acceptEdits', {
        content: 'missing target',
      }),
    ).toBeNull()
  })

  test('canonicalizes the tool-specific path key without changing its schema', () => {
    const block = getGraftTierToolBlock('NotebookEdit', 'acceptEdits', {
      notebook_path: 'notes.ipynb',
    })
    expect(block?.behavior).toBe('allow')
    expect(block?.updatedInput?.notebook_path).toBe(
      join(getCwd(), 'notes.ipynb'),
    )
    expect(block?.updatedInput?.file_path).toBeUndefined()
  })

  test('blocks file-creation shell in auto-edit mode', () => {
    const block = getGraftTierToolBlock('Bash', 'acceptEdits', {
      command: 'touch index.html',
    })
    expect(block?.behavior).toBe('deny')
    expect(block?.message).toContain('Write')
  })

  test('auto-allows allowlisted shell in ask mode', () => {
    const block = getGraftTierToolBlock('Bash', 'default', {
      command: 'gh repo view apache/ossie',
    })
    expect(block?.behavior).toBe('allow')
  })

  test('auto-allows allowlisted shell in code mode', () => {
    const block = getGraftTierToolBlock('Bash', 'acceptEdits', {
      command: 'npm test',
    })
    expect(block?.behavior).toBe('allow')
  })

  test('asks for a privileged shell command in auto-edit mode', () => {
    const block = getGraftTierToolBlock('Bash', 'acceptEdits', {
      command: 'sudo apt install foo',
    })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('elevated privileges')
  })

  test('asks for destructive shell even when allowlisted base', () => {
    const block = getGraftTierToolBlock('Bash', 'default', {
      command: 'git push --force origin main',
    })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('destructive')
  })

  test('blocks shell entirely in safe mode', () => {
    setGraftSafeShellBlocked(true)
    const block = getGraftTierToolBlock('Bash', 'default', {
      command: 'npm test',
    })
    expect(block?.behavior).toBe('deny')
    expect(block?.message).toContain('safe mode')
  })

  test('asks before reading secret paths', () => {
    const block = getGraftTierToolBlock('Read', 'acceptEdits', {
      file_path: '/project/.env',
    })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('sensitive file')
  })

  test('asks before writing secret paths', () => {
    const block = getGraftTierToolBlock('Write', 'default', {
      file_path: '/project/.env',
      content: 'SECRET=1',
    })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('sensitive file')
  })
})

describe('browser and agent tools', () => {
  // getGraftTierToolBlock returns null outside the Graft runtime, so without
  // this the assertions below pass vacuously.
  const prevRuntime = process.env.GRAFT_SRC
  beforeEach(() => {
    process.env.GRAFT_SRC = '1'
  })
  afterEach(() => {
    if (prevRuntime === undefined) delete process.env.GRAFT_SRC
    else process.env.GRAFT_SRC = prevRuntime
  })


  test('a subagent launch in code mode returns a decision instead of throwing', () => {
    // This branch used to contain an unterminated template literal, so it
    // threw ReferenceError: bypass is not defined on every Task launch.
    expect(() => getGraftTierToolBlock('Task', 'acceptEdits', {})).not.toThrow()
    expect(getGraftTierToolBlock('Task', 'acceptEdits', {})).toBeNull()
  })

  test('ask mode does not prompt for a subagent launch', () => {
    expect(getGraftTierToolBlock('Task', 'default', {})).toBeNull()
  })

  test('browser tools are not gated in code mode', () => {
    expect(getGraftTierToolBlock('BrowserUse', 'acceptEdits', {})).toBeNull()
  })

  test('plan mode still pauses agent tools, with a readable message', () => {
    const block = getGraftTierToolBlock('Task', 'plan', {})
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('plan mode')
    expect(block?.message).not.toContain('undefined')
  })
})

describe('workflow tools', () => {
  // getGraftTierToolBlock returns null outside the Graft runtime, so without
  // this the assertions below pass vacuously.
  const prevRuntime = process.env.GRAFT_SRC
  beforeEach(() => {
    process.env.GRAFT_SRC = '1'
  })
  afterEach(() => {
    if (prevRuntime === undefined) delete process.env.GRAFT_SRC
    else process.env.GRAFT_SRC = prevRuntime
  })


  test('TodoWrite is never treated as a file edit', () => {
    expect(getGraftTierToolBlock('TodoWrite', 'plan', { todos: [] })).toBeNull()
    expect(getGraftTierToolBlock('TodoWrite', 'default', { todos: [] })).toBeNull()
  })

  test('ExitPlanMode is not gated by the mode it exits', () => {
    expect(getGraftTierToolBlock('ExitPlanMode', 'plan', {})).toBeNull()
  })

  test('Skill loading needs no permission', () => {
    expect(getGraftTierToolBlock('Skill', 'plan', { skill: 'verify' })).toBeNull()
  })

  test('a real write is still gated in plan mode', () => {
    const block = getGraftTierToolBlock('Write', 'plan', { file_path: 'a.ts' })
    expect(block?.behavior).toBe('ask')
  })
})

describe('everyday shell commands do not interrupt', () => {
  const prevRuntime = process.env.GRAFT_SRC
  beforeEach(() => {
    process.env.GRAFT_SRC = '1'
  })
  afterEach(() => {
    if (prevRuntime === undefined) delete process.env.GRAFT_SRC
    else process.env.GRAFT_SRC = prevRuntime
  })

  // These all used to prompt, because none of them were on the 47-entry
  // allowlist. That turned a coding session into a queue of approvals.
  const ORDINARY = [
    'mkdir -p src/components',
    'cp src/a.ts src/b.ts',
    'sed -i "s/a/b/" src/app.ts',
    'docker build -t app .',
    'cargo run',
    'Get-ChildItem -Recurse',
    './scripts/build.sh',
    'cd app && npm install && npm run build',
  ]

  for (const command of ORDINARY) {
    test(command, () => {
      const block = getGraftTierToolBlock('Bash', 'acceptEdits', { command })
      expect(block?.behavior).not.toBe('ask')
    })
  }

  test('git push still asks — it leaves the machine', () => {
    const block = getGraftTierToolBlock('Bash', 'acceptEdits', {
      command: 'git push origin main',
    })
    expect(block?.behavior).toBe('ask')
  })

  test('rm -rf still asks — that gate is separate and unchanged', () => {
    const block = getGraftTierToolBlock('Bash', 'acceptEdits', {
      command: 'rm -rf build',
    })
    expect(block?.behavior).toBe('ask')
  })

  test('plan mode still refuses to run shell at all', () => {
    const block = getGraftTierToolBlock('Bash', 'plan', { command: 'ls' })
    expect(block?.behavior).toBe('ask')
    expect(block?.message).toContain('Plan mode')
  })
})
