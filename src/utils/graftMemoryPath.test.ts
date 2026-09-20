import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { graftMemoryPath, graftPlanPath } from './graftMemoryPath.js'

const directories: string[] = []
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'graft-memory-'))
  directories.push(dir)
  return dir
}
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('Graft context compatibility', () => {
  test('new projects use Graft filenames', () => {
    const dir = fixture()
    expect(graftMemoryPath(dir)).toBe(join(dir, 'graft.md'))
    expect(graftMemoryPath(dir, true)).toBe(join(dir, 'graft.local.md'))
    expect(graftPlanPath(dir)).toBe(join(dir, 'graftplan.md'))
  })
  test('existing context and plans remain readable without copies or edits', () => {
    const dir = fixture()
    for (const name of ['graft.md', 'graft.local.md', 'graftplan.md']) {
      writeFileSync(join(dir, name), 'Keep my instructions')
    }
    expect(graftMemoryPath(dir)).toBe(join(dir, 'graft.md'))
    expect(graftMemoryPath(dir, true)).toBe(join(dir, 'graft.local.md'))
    expect(graftPlanPath(dir)).toBe(join(dir, 'graftplan.md'))
    expect(readFileSync(graftMemoryPath(dir), 'utf8')).toBe('Keep my instructions')
  })
  test('Graft files take priority while CLAUDE.md remains a fallback', () => {
    const dir = fixture()
    writeFileSync(join(dir, 'CLAUDE.md'), 'Legacy')
    expect(graftMemoryPath(dir)).toBe(join(dir, 'CLAUDE.md'))
    writeFileSync(join(dir, 'graft.md'), 'Current')
    expect(graftMemoryPath(dir)).toBe(join(dir, 'graft.md'))
    expect(readFileSync(join(dir, 'CLAUDE.md'), 'utf8')).toBe('Legacy')
  })
})
