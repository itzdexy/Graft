import { describe, expect, test } from 'bun:test'
import type { AgentSession } from '../agent/types.js'
import {
  formatAgentHudLine,
  shouldShowAgentHud,
  truncateMiddle,
} from './agentStatus.js'

function mockSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 's1',
    cwd: '/proj',
    goal: {
      id: 'g1',
      text: 'Add login endpoint',
      acceptanceCriteria: [],
      createdAt: 1,
    },
    phase: 'execute',
    steps: [
      {
        id: 'a',
        title: 'Inspect auth module',
        description: '',
        status: 'done',
        attempts: 1,
      },
      {
        id: 'b',
        title: 'Implement route',
        description: '',
        status: 'in_progress',
        attempts: 0,
      },
    ],
    currentStepIndex: 1,
    reflections: [],
    contextNotes: [],
    startedAt: 1000,
    updatedAt: 2000,
    maxRetriesPerStep: 3,
    ...overrides,
  }
}

describe('shouldShowAgentHud', () => {
  test('hides when no session', () => {
    expect(shouldShowAgentHud(null)).toBe(false)
  })

  test('hides when done or failed', () => {
    expect(shouldShowAgentHud(mockSession({ phase: 'done' }))).toBe(false)
    expect(shouldShowAgentHud(mockSession({ phase: 'failed' }))).toBe(false)
  })

  test('shows for active phases', () => {
    expect(shouldShowAgentHud(mockSession({ phase: 'execute' }))).toBe(true)
  })
})

describe('formatAgentHudLine', () => {
  test('includes step progress and last tool', () => {
    const line = formatAgentHudLine(
      mockSession({ autoFix: true, autoFixRound: 2, maxAutoFixRounds: 5 }),
      'Edit: src/auth.ts',
    )
    expect(line).toContain('Agent 1/2')
    expect(line).toContain('Implement route')
    expect(line).toContain('Edit: src/auth.ts')
    expect(line).toContain('autofix 2/5')
    expect(line).toContain(' · ')
  })
})

describe('truncateMiddle', () => {
  test('truncates long strings', () => {
    expect(truncateMiddle('abcdefghij', 8)).toBe('abcde...')
  })
})
