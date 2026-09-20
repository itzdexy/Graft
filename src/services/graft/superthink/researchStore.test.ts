import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  goalSlug,
  loadResearchBrief,
  researchBriefPath,
  saveResearchBrief,
  summarizeResearchBrief,
} from './researchStore.js'

describe('goalSlug', () => {
  test('normalizes goal text', () => {
    expect(goalSlug('Build a Portfolio Site!')).toBe('build-a-portfolio-site')
    expect(goalSlug('   ')).toBe('goal')
  })
})

describe('research brief persistence', () => {
  let dir: string

  afterEach(() => {
    if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true })
  })

  test('save and load round-trip', () => {
    dir = mkdtempSync(join(tmpdir(), 'graft-superthink-'))
    const goal = 'build a todo app'
    const path = saveResearchBrief(dir, goal, '# Summary\n\nUse React.\n')
    expect(path).toBe(researchBriefPath(dir, goal))
    expect(existsSync(path)).toBe(true)
    expect(loadResearchBrief(dir, goal)).toContain('Use React')
    expect(loadResearchBrief(dir, 'other goal')).toBeNull()
  })
})

describe('summarizeResearchBrief', () => {
  test('skips headings and caps lines', () => {
    const brief = ['# Title', '', '- finding one', '- finding two'].join('\n')
    const summary = summarizeResearchBrief(brief, 1)
    expect(summary).toBe('- finding one')
    expect(summary).not.toContain('#')
  })
})
