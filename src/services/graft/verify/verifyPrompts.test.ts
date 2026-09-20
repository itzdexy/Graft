import { describe, expect, test } from 'bun:test'
import type { AgentSession } from '../agent/types.js'
import {
  buildAutoFixExhaustedPrompt,
  isAutoFixBudgetExhausted,
} from './verifyPrompts.js'

describe('auto-fix budget enforcement', () => {
  test('not exhausted while within the round budget', () => {
    expect(isAutoFixBudgetExhausted(1, 5)).toBe(false)
    // The last allowed round (round === max) is still a fix prompt.
    expect(isAutoFixBudgetExhausted(5, 5)).toBe(false)
  })

  test('exhausted once the round exceeds the budget', () => {
    expect(isAutoFixBudgetExhausted(6, 5)).toBe(true)
  })

  test('falls back to the default cap when maxRounds is invalid', () => {
    // 0 / NaN must not disable the cap (which would loop forever).
    expect(isAutoFixBudgetExhausted(6, 0)).toBe(true)
    expect(isAutoFixBudgetExhausted(6, Number.NaN)).toBe(true)
    expect(isAutoFixBudgetExhausted(3, 0)).toBe(false)
  })

  test('exhausted prompt tells the model to stop and escalate', () => {
    const session = {
      goal: { text: 'make the build green' },
    } as unknown as AgentSession
    const blocks = buildAutoFixExhaustedPrompt(session, 'tsc: 3 errors', 5)
    const text = (blocks[0] as { type: 'text'; text: string }).text
    expect(text).toContain('budget exhausted')
    expect(text).toContain('make the build green')
    expect(text).toContain('Stop and escalate')
    expect(text).toContain('tsc: 3 errors')
    expect(text).toContain('5 round')
  })
})
