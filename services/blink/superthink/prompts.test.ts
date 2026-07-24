import { describe, expect, test } from 'bun:test'
import { mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  buildDesignMarkdown,
  buildSuperthinkBuildPrompt,
  buildSuperthinkNeedClarifyMessage,
  buildSuperthinkResearchPrompt,
  formatSuperthinkHelp,
  SUPERTHINK_METHODOLOGY,
} from './prompts.js'
import { buildDefaultQuestions } from './core.js'

describe('superthink prompts', () => {
  test('help documents phases and commands', () => {
    const text = formatSuperthinkHelp()
    expect(text).toContain('research')
    expect(text).toContain('/superthink go')
    expect(text).toContain('localhost')
  })

  test('research prompt includes goal URLs and file paths', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'blink-st-prompt-'))
    const goal = 'build docs site https://example.com/guide'
    const text = buildSuperthinkResearchPrompt(cwd, goal)
    expect(text).toContain(goal)
    expect(text).toContain('https://example.com/guide')
    expect(text).toContain('WebFetch')
    expect(text).toContain('research.md')
    expect(text).toContain('Do NOT write application code')
  })

  test('build prompt enforces methodology and plan steps', () => {
    const goal = 'portfolio site'
    const questions = buildDefaultQuestions(goal)
    const answers = questions.map(q => ({
      id: q.id,
      value: q.id === 'outcome' ? 'A live portfolio' : '',
    }))
    const plan = {
      summary: 'Build a portfolio',
      decisions: ['Stack → React'],
      steps: ['Scaffold', 'Style', 'Deploy'],
    }
    const text = buildSuperthinkBuildPrompt(goal, questions, answers, plan)
    expect(text).toContain(SUPERTHINK_METHODOLOGY)
    expect(text).toContain('Write code now')
    expect(text).toContain('1. Scaffold')
    expect(text).toContain('live portfolio')
  })

  test('design markdown includes goal line and plan', () => {
    const goal = 'api service'
    const questions = buildDefaultQuestions(goal)
    const answers = questions.map(q => ({ id: q.id, value: '' }))
    const plan = { summary: 'API', decisions: [], steps: ['Route handlers'] }
    const md = buildDesignMarkdown(goal, questions, answers, plan, 'brief notes')
    expect(md.startsWith('goal: api service')).toBe(true)
    expect(md).toContain('## Research notes')
    expect(md).toContain('brief notes')
  })

  test('need clarify message points to continue', () => {
    const text = buildSuperthinkNeedClarifyMessage('my feature')
    expect(text).toContain('/superthink continue')
    expect(text).toContain('my feature')
  })
})
