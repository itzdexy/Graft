import { describe, expect, test } from 'bun:test'
import {
  WORKFLOW_PROMPT_BUILDERS,
  buildWorkflowPrintArgs,
} from './blink-workflow-prompts.js'

describe('blink-workflow-prompts', () => {
  test('buildWorkflowPrintArgs wraps review in -p', () => {
    const args = buildWorkflowPrintArgs('review', ['src/auth.ts'])
    expect(args[0]).toBe('-p')
    expect(args.join(' ')).toContain('Senior code review')
    expect(args.join(' ')).toContain('src/auth.ts')
  })

  test('ask passes question through', () => {
    const args = buildWorkflowPrintArgs('ask', ['what is this repo?'])
    expect(args[0]).toBe('-p')
    expect(args[1]).toBe('what is this repo?')
  })

  test('plan prompt mentions blinkplan.md', () => {
    expect(WORKFLOW_PROMPT_BUILDERS.plan('oauth')).toContain('blinkplan.md')
  })
})
