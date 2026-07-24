import { describe, expect, test } from 'bun:test'
import { buildExecutionPrompt, buildStatusPrompt } from './ExecutionEngine.js'
import type { AgentSession } from './types.js'

function session(partial: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 's1',
    cwd: '/proj',
    goal: {
      id: 'g1',
      text: 'Ship feature',
      acceptanceCriteria: ['Tests pass'],
      createdAt: 0,
    },
    phase: 'execute',
    steps: [
      {
        id: '1',
        title: 'Implement API',
        description: 'Add REST handlers',
        status: 'in_progress',
        specialist: 'coder',
        attempts: 0,
      },
    ],
    currentStepIndex: 0,
    reflections: [],
    contextNotes: [],
    startedAt: 0,
    updatedAt: 0,
    maxRetriesPerStep: 3,
    ...partial,
  }
}

describe('ExecutionEngine prompts', () => {
  test('buildExecutionPrompt includes goal and agent loop', () => {
    const blocks = buildExecutionPrompt(session())
    expect(blocks).toHaveLength(1)
    const text = blocks[0]!.type === 'text' ? blocks[0].text : ''
    expect(text).toContain('Ship feature')
    expect(text).toContain('Observe → Think → Plan')
    expect(text).toContain('Implement API')
    expect(text).toContain('Tests pass')
  })

  test('buildExecutionPrompt adds verify block in verify phase', () => {
    const blocks = buildExecutionPrompt(
      session({
        phase: 'verify',
        steps: [
          {
            id: 'v',
            title: 'Verify changes',
            description: 'Run tests',
            status: 'in_progress',
            attempts: 0,
          },
        ],
      }),
    )
    const text = blocks[0]!.type === 'text' ? blocks[0].text : ''
    expect(text.toLowerCase()).toContain('verify')
  })

  test('buildExecutionPrompt includes loop guard and handoff hints', () => {
    const blocks = buildExecutionPrompt(
      session({
        currentStepIndex: 1,
        steps: [
          {
            id: '1',
            title: 'Plan',
            description: 'Plan work',
            status: 'done',
            specialist: 'planner',
            attempts: 1,
          },
          {
            id: '2',
            title: 'Implement API',
            description: 'Add REST handlers',
            status: 'in_progress',
            specialist: 'coder',
            attempts: 0,
          },
        ],
      }),
    )
    const text = blocks[0]!.type === 'text' ? blocks[0].text : ''
    expect(text).toContain('Loop guard')
    expect(text).toContain('Handoff: planner → coder')
  })
})