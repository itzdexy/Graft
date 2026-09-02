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

  test('verifier receives raw-evidence instructions instead of trusting the builder summary', () => {
    const orchestrated = session({
      phase: 'verify',
      orchestration: {
        schemaVersion: 2,
        enabled: true,
        state: 'verifying',
        repairRound: 0,
        maxRepairRounds: 2,
        warnings: [],
        assignments: {
          planner: { role: 'planner', providerId: 'p', modelId: 'plan' },
          builder: { role: 'builder', providerId: 'p', modelId: 'build' },
          verifier: { role: 'verifier', providerId: 'p', modelId: 'verify' },
        },
        evidence: [{
          stepId: '1', role: 'builder', modelId: 'build', summary: 'Changed API',
          filesChanged: ['src/api.ts'], commands: ['bun test'], failures: [], createdAt: 1,
        }],
      },
    })
    const text = buildExecutionPrompt(orchestrated)[0]!.type === 'text'
      ? buildExecutionPrompt(orchestrated)[0]!.text
      : ''
    expect(text).toContain('actual diff and raw test/build output')
    expect(text).toContain('src/api.ts')
    expect(text).toContain('bun test')
    expect(text).toContain('### Verification approved')
    expect(text).not.toContain('### Step complete')
  })

  test('ideation and its approval checkpoint stay on real options before planning', () => {
    for (const state of ['ideating', 'awaiting_idea'] as const) {
      const orchestrated = session({
        phase: 'plan',
        orchestration: {
          schemaVersion: 2,
          enabled: true,
          state,
          approvalPolicy: 'ideas-and-plan',
          repairRound: 0,
          maxRepairRounds: 2,
          warnings: [],
          assignments: {
            planner: { role: 'planner', providerId: 'p', modelId: 'plan' },
            builder: { role: 'builder', providerId: 'p', modelId: 'build' },
            verifier: { role: 'verifier', providerId: 'p', modelId: 'verify' },
          },
          evidence: [],
        },
      })
      const block = buildExecutionPrompt(orchestrated)[0]!
      const text = block.type === 'text' ? block.text : ''
      expect(text).toContain('2–3 materially different approaches')
      expect(text).toContain('Choose 1–3')
      expect(text).toContain('### Ideas ready')
      expect(text).not.toContain('### Plan ready')
    }
  })
})
