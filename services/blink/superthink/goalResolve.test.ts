import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { isVagueSuperthinkGoal, resolveSuperthinkGoal } from './goalResolve.js'
import { goalSlug, researchBriefPath } from './researchStore.js'
import {
  deriveSessionPhase,
  recordSessionGoal,
  setActiveSuperthinkGoal,
} from './sessionStore.js'

describe('isVagueSuperthinkGoal', () => {
  test('detects continuation phrases', () => {
    expect(isVagueSuperthinkGoal('code it')).toBe(true)
    expect(isVagueSuperthinkGoal('go')).toBe(true)
    expect(isVagueSuperthinkGoal('implement')).toBe(true)
  })
  test('real goals are not vague', () => {
    expect(isVagueSuperthinkGoal('build a portfolio website')).toBe(false)
  })
})

describe('resolveSuperthinkGoal', () => {
  test('uses active goal for vague input', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'blink-st-'))
    setActiveSuperthinkGoal(cwd, 'build a portfolio website')
    expect(resolveSuperthinkGoal(cwd, 'code it')).toBe('build a portfolio website')
  })

  test('uses session with research when no active file', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'blink-st-'))
    const goal = 'build a portfolio website'
    const slug = goalSlug(goal)
    const dir = join(cwd, '.blink', 'superthink', slug)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'research.md'), '# brief\n', 'utf8')
    recordSessionGoal(cwd, goal)
    expect(resolveSuperthinkGoal(cwd, 'go')).toBe(goal)
  })
})

describe('deriveSessionPhase', () => {
  test('phases follow artifacts on disk', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'blink-st-'))
    const goal = 'build a todo app'
    expect(deriveSessionPhase(cwd, goal)).toBe('research')
    const dir = join(cwd, '.blink', 'superthink', goalSlug(goal))
    mkdirSync(dir, { recursive: true })
    writeFileSync(researchBriefPath(cwd, goal), 'x', 'utf8')
    expect(deriveSessionPhase(cwd, goal)).toBe('clarify')
  })
})
