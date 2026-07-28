import { describe, expect, test } from 'bun:test'
import {
  buildCoordinatorBrief,
  detectStepConflicts,
} from './coordinator.js'
import type { AgentSession } from './types.js'

function session(partial: Partial<AgentSession>): AgentSession {
  return {
    id: 's1',
    cwd: '/proj',
    goal: { text: 'Ship feature', createdAt: 0 },
    phase: 'execute',
    status: 'running',
    steps: [],
    reflections: [],
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

describe('coordinator', () => {
  test('brief includes goal and next step', () => {
    const brief = buildCoordinatorBrief(
      session({
        steps: [
          {
            id: '1',
            title: 'Implement API',
            status: 'pending',
            specialist: 'coder',
          },
        ],
      }),
    )
    expect(brief).toContain('Ship feature')
    expect(brief).toContain('Implement API')
  })

  test('detects reviewer vs coder conflict', () => {
    const conflicts = detectStepConflicts([
      {
        id: 'c',
        title: 'Code',
        status: 'done',
        specialist: 'coder',
      },
      {
        id: 'r',
        title: 'Review',
        status: 'failed',
        specialist: 'reviewer',
        lastError: 'style issues',
      },
    ])
    expect(conflicts.some(c => c.issue.includes('Reviewer'))).toBe(true)
  })
})
