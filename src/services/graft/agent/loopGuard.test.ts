import { describe, expect, test } from 'bun:test'
import type { AgentSession } from './types.js'
import {
  applyLoopStop,
  checkLoopLimits,
  createLoopState,
  isEmptyOrInvalidModelOutput,
  recordAgentToolCall,
  recordAgentTurn,
  toolCallSignature,
} from './loopGuard.js'
import { buildSessionSummary } from './sessionSummary.js'

function baseSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    id: 's1',
    cwd: '/proj',
    goal: {
      id: 'g1',
      text: 'Fix login bug',
      acceptanceCriteria: ['Tests pass'],
      createdAt: Date.now(),
    },
    phase: 'execute',
    steps: [
      {
        id: '1',
        title: 'Implement fix',
        description: 'Patch auth',
        status: 'in_progress',
        specialist: 'coder',
        attempts: 0,
      },
      {
        id: '2',
        title: 'Verify changes',
        description: 'Run tests',
        status: 'pending',
        specialist: 'debugger',
        attempts: 0,
      },
    ],
    currentStepIndex: 0,
    reflections: [],
    contextNotes: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
    maxRetriesPerStep: 3,
    loop: createLoopState(),
    ...overrides,
  }
}

describe('loopGuard', () => {
  test('stops after max turns', () => {
    const session = baseSession({ maxTurns: 3 })
    session.loop!.turnCount = 2
    const check = recordAgentTurn(session, 'Working on the fix...')
    expect(check.allowed).toBe(false)
    expect(check.reason).toBe('max_turns')
    const failed = applyLoopStop(session, check)
    expect(failed.phase).toBe('failed')
  })

  test('handles tool failure without stopping on first failure', () => {
    const session = baseSession({ maxToolCalls: 100 })
    const input = { command: 'npm test' }
    const first = recordAgentToolCall(session, {
      toolName: 'Bash',
      input,
      ok: false,
    })
    expect(first.allowed).toBe(true)
    expect(session.loop!.repeatedFailureCount).toBe(1)
  })

  test('stops after repeated identical failed tool calls', () => {
    const session = baseSession()
    const input = { command: 'npm test' }
    recordAgentToolCall(session, { toolName: 'Bash', input, ok: false })
    recordAgentToolCall(session, { toolName: 'Bash', input, ok: false })
    const third = recordAgentToolCall(session, {
      toolName: 'Bash',
      input,
      ok: false,
    })
    expect(third.allowed).toBe(false)
    expect(third.reason).toBe('repeated_failure')
    expect(third.message).toContain('Bash')
  })

  test('resets repeated failure count after successful tool call', () => {
    const session = baseSession()
    const input = { command: 'npm test' }
    recordAgentToolCall(session, { toolName: 'Bash', input, ok: false })
    recordAgentToolCall(session, { toolName: 'Bash', input, ok: false })
    recordAgentToolCall(session, {
      toolName: 'Bash',
      input: { command: 'npm run lint' },
      ok: true,
    })
    expect(session.loop!.repeatedFailureCount).toBe(0)
  })

  test('handles empty model output', () => {
    const session = baseSession()
    expect(isEmptyOrInvalidModelOutput('')).toBe(true)
    expect(isEmptyOrInvalidModelOutput('   ')).toBe(true)
    recordAgentTurn(session, '')
    const second = recordAgentTurn(session, '')
    expect(second.allowed).toBe(false)
    expect(second.reason).toBe('empty_output')
  })

  test('accepts substantive model output', () => {
    expect(
      isEmptyOrInvalidModelOutput(
        'I read auth.ts and will patch the session handler next.',
      ),
    ).toBe(false)
  })

  test('stops on session timeout', () => {
    const session = baseSession({ sessionTimeoutMs: 1000 })
    session.loop!.startedAt = Date.now() - 2000
    const check = checkLoopLimits(session)
    expect(check.allowed).toBe(false)
    expect(check.reason).toBe('session_timeout')
  })

  test('toolCallSignature is stable for same input', () => {
    const a = toolCallSignature('Bash', { command: 'npm test' })
    const b = toolCallSignature('Bash', { command: 'npm test' })
    expect(a).toBe(b)
    expect(a).not.toBe(toolCallSignature('Bash', { command: 'npm run lint' }))
  })
})

describe('sessionSummary', () => {
  test('summarizes completed session accurately', () => {
    const session = baseSession({
      phase: 'done',
      goal: {
        id: 'g1',
        text: 'Fix login bug',
        acceptanceCriteria: ['Tests pass'],
        createdAt: Date.now(),
        completedAt: Date.now(),
      },
      steps: [
        {
          id: '1',
          title: 'Implement fix',
          description: 'Patch auth',
          status: 'done',
          specialist: 'coder',
          attempts: 1,
          completedAt: Date.now(),
        },
        {
          id: '2',
          title: 'Verify changes',
          description: 'Run tests',
          status: 'done',
          specialist: 'debugger',
          attempts: 1,
          completedAt: Date.now(),
        },
      ],
      currentStepIndex: 1,
      reflections: ['Updated src/auth.ts and tests passed.'],
    })
    const summary = buildSessionSummary(session)
    expect(summary.goalStatus).toBe('completed')
    expect(summary.stepsDone).toBe(2)
    expect(summary.stepsTotal).toBe(2)
    expect(summary.body).toContain('Fix login bug')
    expect(summary.body).toContain('Implement fix')
    expect(summary.body).not.toContain('undefined')
  })

  test('summarizes failed session with blockers', () => {
    const session = baseSession({
      phase: 'failed',
      steps: [
        {
          id: '1',
          title: 'Implement fix',
          description: 'Patch auth',
          status: 'failed',
          specialist: 'coder',
          attempts: 3,
          lastError: 'Tests still failing',
        },
      ],
      loop: {
        ...createLoopState(),
        stopReason: 'repeated_failure',
        stopMessage: 'Same Bash command failed 3 times',
      },
    })
    const summary = buildSessionSummary(session)
    expect(summary.goalStatus).toBe('failed')
    expect(summary.blockers.length).toBeGreaterThan(0)
    expect(summary.body).toContain('Tests still failing')
  })
})
