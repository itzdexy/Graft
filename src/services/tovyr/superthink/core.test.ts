import { describe, expect, test } from 'bun:test'
import {
  answersToContext,
  buildDefaultQuestions,
  detectProjectKind,
  normalizeSubmittedAnswers,
  parseSuperthinkArgs,
  synthesizePlan,
} from './core.js'
import type { SuperthinkQuestion } from './types.js'

describe('parseSuperthinkArgs', () => {
  test('blank / help', () => {
    expect(parseSuperthinkArgs('').command).toBe('help')
    expect(parseSuperthinkArgs('help').command).toBe('help')
    expect(parseSuperthinkArgs('?').command).toBe('help')
  })
  test('disable alias maps to off', () => {
    expect(parseSuperthinkArgs('disable').command).toBe('off')
    expect(parseSuperthinkArgs('enable').command).toBe('on')
    expect(parseSuperthinkArgs('on').command).toBe('on')
    expect(parseSuperthinkArgs('off').command).toBe('off')
    expect(parseSuperthinkArgs('status').command).toBe('status')
  })
  test('result with path', () => {
    const p = parseSuperthinkArgs('result dist/preview')
    expect(p.command).toBe('result')
    expect(p.goal).toBe('dist/preview')
  })
  test('continue skips to questionnaire with goal', () => {
    const p = parseSuperthinkArgs('continue build a portfolio site')
    expect(p.command).toBe('continue')
    expect(p.goal).toBe('build a portfolio site')
  })
  test('go command', () => {
    const p = parseSuperthinkArgs('go')
    expect(p.command).toBe('go')
  })
  test('code it routes as run goal text (resolved later)', () => {
    const p = parseSuperthinkArgs('code it')
    expect(p.command).toBe('run')
    expect(p.goal).toBe('code it')
  })
})

describe('detectProjectKind + question tailoring', () => {
  test('detects web and adds a stack question', () => {
    expect(detectProjectKind('make a landing page in react')).toBe('web')
    const qs = buildDefaultQuestions('make a landing page in react')
    expect(qs.some(q => q.id === 'stack')).toBe(true)
    // Core questions are always present.
    expect(qs.some(q => q.id === 'outcome' && q.required)).toBe(true)
  })
  test('detects cli and adds a language question', () => {
    expect(detectProjectKind('a command-line tool to rename files')).toBe('cli')
    const qs = buildDefaultQuestions('a command-line tool to rename files')
    expect(qs.some(q => q.id === 'language')).toBe(true)
  })
  test('general goal still gets the TDD + risks questions', () => {
    const qs = buildDefaultQuestions('do something useful')
    expect(qs.some(q => q.id === 'tests' && q.type === 'boolean')).toBe(true)
    expect(qs.some(q => q.id === 'risks')).toBe(true)
  })
})

describe('normalizeSubmittedAnswers', () => {
  const questions: SuperthinkQuestion[] = [
    { id: 'outcome', prompt: 'outcome?', type: 'text', required: true },
    { id: 'tests', prompt: 'tdd?', type: 'boolean' },
    { id: 'tags', prompt: 'tags?', type: 'multichoice', options: ['a', 'b', 'c'] },
  ]

  test('coerces types and flags missing required', () => {
    const { answers, missingRequired } = normalizeSubmittedAnswers(questions, {
      outcome: '   ',
      // tests checkbox absent => false
      tags: ['a', 'c'],
    })
    expect(missingRequired).toEqual(['outcome'])
    expect(answers.find(a => a.id === 'tests')?.value).toBe(false)
    expect(answers.find(a => a.id === 'tags')?.value).toEqual(['a', 'c'])
  })

  test('a present checkbox becomes true; comma string becomes a list', () => {
    const { answers, missingRequired } = normalizeSubmittedAnswers(questions, {
      outcome: 'ship it',
      tests: 'true',
      tags: 'a, b',
    })
    expect(missingRequired).toHaveLength(0)
    expect(answers.find(a => a.id === 'tests')?.value).toBe(true)
    expect(answers.find(a => a.id === 'tags')?.value).toEqual(['a', 'b'])
  })
})

describe('synthesizePlan', () => {
  const questions: SuperthinkQuestion[] = [
    { id: 'outcome', prompt: 'outcome?', type: 'text', required: true },
    { id: 'tests', prompt: 'tdd?', type: 'boolean' },
    { id: 'stack', prompt: 'stack?', type: 'choice', options: ['React'] },
  ]

  test('summary uses the outcome and TDD answer adds a red/green step', () => {
    const { answers } = normalizeSubmittedAnswers(questions, {
      outcome: 'users can log in',
      tests: 'true',
      stack: 'React',
    })
    const plan = synthesizePlan('build auth', questions, answers)
    expect(plan.summary).toContain('users can log in')
    expect(plan.decisions.some(d => d.includes('React'))).toBe(true)
    expect(plan.steps.some(s => /red/i.test(s) && /green/i.test(s))).toBe(true)
  })

  test('no TDD => no red/green step, blank answers omitted from decisions', () => {
    const { answers } = normalizeSubmittedAnswers(questions, {
      outcome: 'x',
      // tests absent => false
      stack: '',
    })
    const plan = synthesizePlan('g', questions, answers)
    expect(plan.steps.some(s => /red/i.test(s))).toBe(false)
    expect(plan.decisions.some(d => d.toLowerCase().includes('stack'))).toBe(false)
  })
})

describe('answersToContext', () => {
  test('renders booleans as yes/no and lists joined', () => {
    const questions: SuperthinkQuestion[] = [
      { id: 'tests', prompt: 'tdd?', type: 'boolean' },
      { id: 'tags', prompt: 'tags?', type: 'multichoice' },
    ]
    const { answers } = normalizeSubmittedAnswers(questions, {
      tests: 'true',
      tags: ['x', 'y'],
    })
    const ctx = answersToContext(questions, answers)
    expect(ctx).toContain('→ yes')
    expect(ctx).toContain('→ x, y')
  })
})
