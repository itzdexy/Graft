import { afterEach, describe, expect, test } from 'bun:test'
import {
  advanceOrchestration,
  shouldUseAdaptiveOrchestration,
} from './orchestrationState.js'

describe('advanceOrchestration', () => {
  test('moves through ideate, plan, build, verify, and completion', () => {
    expect(advanceOrchestration('ideating', 'ideas_ready', 0, 2)).toMatchObject({ state: 'awaiting_idea' })
    expect(advanceOrchestration('awaiting_idea', 'idea_accepted', 0, 2)).toMatchObject({ state: 'drafting_plan' })
    expect(advanceOrchestration('drafting_plan', 'plan_ready', 0, 2)).toMatchObject({ state: 'awaiting_plan' })
    expect(advanceOrchestration('awaiting_plan', 'plan_accepted', 0, 2)).toMatchObject({ state: 'building' })
    expect(advanceOrchestration('building', 'build_complete', 0, 2)).toMatchObject({ state: 'verifying' })
    expect(advanceOrchestration('verifying', 'approved', 0, 2)).toMatchObject({ state: 'complete' })
  })

  test('bounds verifier repair loops', () => {
    expect(advanceOrchestration('verifying', 'needs_changes', 0, 2)).toEqual({ state: 'building', repairRound: 1 })
    expect(advanceOrchestration('verifying', 'needs_changes', 1, 2)).toEqual({ state: 'blocked', repairRound: 2 })
  })
})

describe('shouldUseAdaptiveOrchestration', () => {
  const original = process.env.GRAFT_MULTI_MODEL
  afterEach(() => {
    if (original === undefined) delete process.env.GRAFT_MULTI_MODEL
    else process.env.GRAFT_MULTI_MODEL = original
  })

  test('uses orchestration for substantial builds, not casual or tiny requests', () => {
    expect(shouldUseAdaptiveOrchestration('hello')).toBe(false)
    expect(shouldUseAdaptiveOrchestration('rename foo to bar in one file')).toBe(false)
    expect(shouldUseAdaptiveOrchestration('build me a website')).toBe(true)
    expect(shouldUseAdaptiveOrchestration('code me a calculator in Python')).toBe(true)
    expect(shouldUseAdaptiveOrchestration('build a multi-file authentication flow, tests, and documentation')).toBe(true)
  })

  test('honors the explicit off switch', () => {
    process.env.GRAFT_MULTI_MODEL = '0'
    expect(shouldUseAdaptiveOrchestration('build a full application and verify it')).toBe(false)
  })
})
