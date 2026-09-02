import { describe, expect, test } from 'bun:test'
import { join } from 'path'
import { getTovyrMds, isMemoryFilePath, type MemoryFileInfo } from './tovyrmd.js'

describe('isMemoryFilePath', () => {
  test('recognizes AGENTS.md and TOVYRCODE.md context files', () => {
    expect(isMemoryFilePath(join('/repo', 'AGENTS.md'))).toBe(true)
    expect(isMemoryFilePath(join('/repo', 'TOVYRCODE.md'))).toBe(true)
    // nested directories too (root-down-to-cwd walk)
    expect(isMemoryFilePath(join('/repo', 'packages', 'web', 'AGENTS.md'))).toBe(
      true,
    )
  })

  test('still recognizes legacy tovyr.md / CLAUDE.md and their .local variants', () => {
    expect(isMemoryFilePath(join('/repo', 'tovyr.md'))).toBe(true)
    expect(isMemoryFilePath(join('/repo', 'tovyr.local.md'))).toBe(true)
    expect(isMemoryFilePath(join('/repo', 'CLAUDE.md'))).toBe(true)
    expect(isMemoryFilePath(join('/repo', 'CLAUDE.local.md'))).toBe(true)
  })

  test('does not treat unrelated markdown as memory files', () => {
    expect(isMemoryFilePath(join('/repo', 'README.md'))).toBe(false)
    expect(isMemoryFilePath(join('/repo', 'docs', 'guide.md'))).toBe(false)
  })
})

describe('getTovyrMds injection', () => {
  test('injects AGENTS.md content as project instructions', () => {
    const files: MemoryFileInfo[] = [
      {
        path: '/repo/AGENTS.md',
        type: 'Project',
        content: 'Use bun, not npm. Run `bun test` to verify.',
      },
    ]
    const injected = getTovyrMds(files)
    expect(injected).toContain('/repo/AGENTS.md')
    expect(injected).toContain('project instructions, checked into the codebase')
    expect(injected).toContain('Use bun, not npm')
  })

  test('preserves precedence order: later files (closer to cwd) appear last', () => {
    const files: MemoryFileInfo[] = [
      { path: '/repo/AGENTS.md', type: 'Project', content: 'ROOT_RULE' },
      { path: '/repo/app/AGENTS.md', type: 'Project', content: 'LEAF_RULE' },
    ]
    const injected = getTovyrMds(files)
    expect(injected.indexOf('ROOT_RULE')).toBeLessThan(
      injected.indexOf('LEAF_RULE'),
    )
  })
})
