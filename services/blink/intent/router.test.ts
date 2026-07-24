import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveBlinkIntent, routeBlinkCliPrompt } from './router.js'
import { setSuperthinkEnabled } from '../superthink/state.js'
import { setActiveSuperthinkGoal } from '../superthink/sessionStore.js'

describe('resolveBlinkIntent', () => {
  test('build rust web server → build intent', () => {
    const intent = resolveBlinkIntent('build a rust web server')
    expect(intent.kind).toBe('build')
    expect(intent.suggestedCommand).toContain('/agent start --autofix')
    expect(intent.preferAgentLoop).toBe(true)
  })

  test('code me a html → build intent', () => {
    const intent = resolveBlinkIntent('code me a html')
    expect(intent.kind).toBe('build')
    expect(intent.suggestedCommand).toContain('/agent start --autofix')
  })

  test('fix failing tests → autofix agent', () => {
    const intent = resolveBlinkIntent('fix my failing tests')
    expect(intent.kind).toBe('fix')
    expect(intent.suggestedCommand).toContain('--autofix')
  })

  test('deploy staging → devops specialists', () => {
    const intent = resolveBlinkIntent('deploy staging')
    expect(intent.kind).toBe('deploy')
    expect(intent.specialistHints).toContain('devops')
  })

  test('research vector databases', () => {
    const intent = resolveBlinkIntent('research the best vector databases')
    expect(intent.kind).toBe('research')
    expect(intent.suggestedCommand).toContain('/browser research')
  })

  test('github issue URL → resolve-issue', () => {
    const intent = resolveBlinkIntent(
      'fix https://github.com/acme/app/issues/42',
    )
    expect(intent.kind).toBe('github')
    expect(intent.suggestedCommand).toContain('/resolve-issue')
  })

  test('github issue reference', () => {
    const intent = resolveBlinkIntent('open github issue #421 and fix it')
    expect(intent.kind).toBe('github')
  })

  test('benchmark application', () => {
    const intent = resolveBlinkIntent('benchmark my application')
    expect(intent.kind).toBe('benchmark')
    expect(intent.specialistHints).toContain('benchmark')
  })

  test('explain codebase', () => {
    const intent = resolveBlinkIntent('explain this codebase')
    expect(intent.kind).toBe('explain')
    expect(intent.suggestedCommand).toBe('/analyze')
  })

  test('optimize fps on pc', () => {
    const intent = resolveBlinkIntent('optimize fps on my pc')
    expect(intent.kind).toBe('optimize')
  })

  test('general chat stays chat', () => {
    const intent = resolveBlinkIntent('what can you do?')
    expect(intent.kind).toBe('general')
    expect(intent.suggestedCommand).toBe('what can you do?')
    expect(intent.preferAgentLoop).toBe(false)
  })
})

describe('routeBlinkCliPrompt', () => {
  let cwd: string

  afterEach(() => {
    setSuperthinkEnabled(cwd, false)
    rmSync(cwd, { recursive: true, force: true })
  })

  test('rewrites natural-language CLI goals', () => {
    cwd = mkdtempSync(join(tmpdir(), 'blink-router-'))
    expect(routeBlinkCliPrompt('build a rust web server', cwd)).toContain('/agent start --autofix')
    expect(routeBlinkCliPrompt('/agent start x', cwd)).toBe('/agent start x')
    expect(routeBlinkCliPrompt('hello', cwd)).toBe('hello')
    expect(routeBlinkCliPrompt('what can you do?', cwd)).toBe('what can you do?')
  })

  test('superthink mode ON routes to /superthink', () => {
    cwd = mkdtempSync(join(tmpdir(), 'blink-router-'))
    setSuperthinkEnabled(cwd, true)
    expect(routeBlinkCliPrompt('build a portfolio website', cwd)).toBe(
      '/superthink build a portfolio website',
    )
  })

  test('superthink mode ON routes vague continuations to go', () => {
    cwd = mkdtempSync(join(tmpdir(), 'blink-router-'))
    setSuperthinkEnabled(cwd, true)
    setActiveSuperthinkGoal(cwd, 'build a portfolio website')
    expect(routeBlinkCliPrompt('code it', cwd)).toBe('/superthink go')
  })
})
