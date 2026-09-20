import { describe, expect, test } from 'bun:test'
import {
  WORKFLOW_PROMPT_BUILDERS,
  buildWorkflowPrintArgs,
} from './graft-workflow-prompts.js'

describe('graft-workflow-prompts', () => {
  test('buildWorkflowPrintArgs wraps review in -p', () => {
    const args = buildWorkflowPrintArgs('review', ['src/auth.ts'])
    expect(args[0]).toBe('-p')
    expect(args.join(' ')).toContain('senior engineer')
    expect(args.join(' ')).toContain('src/auth.ts')
  })

  test('review with no scope uses default scope', () => {
    const args = buildWorkflowPrintArgs('review', [])
    expect(args[0]).toBe('-p')
    expect(args.join(' ')).toContain('git diff')
  })

  test('fix with no scope uses default goal', () => {
    const args = buildWorkflowPrintArgs('fix', [])
    expect(args[0]).toBe('-p')
    expect(args.join(' ')).toContain('working tree')
  })

  test('ask passes question through', () => {
    const args = buildWorkflowPrintArgs('ask', ['what is this repo?'])
    expect(args[0]).toBe('-p')
    expect(args[1]).toBe('what is this repo?')
  })

  test('plan prompt mentions graftplan.md', () => {
    expect(WORKFLOW_PROMPT_BUILDERS.plan('oauth')).toContain('graftplan.md')
  })
})
