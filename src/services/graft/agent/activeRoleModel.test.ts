import { describe, expect, test } from 'bun:test'
import { getActiveRoleModel } from './activeRoleModel.js'
import type { AgentSession } from './types.js'

function session(state: NonNullable<AgentSession['orchestration']>['state']): AgentSession {
  return {
    id: 's', cwd: '/x', phase: 'execute', currentStepIndex: 0, reflections: [], contextNotes: [],
    startedAt: 1, updatedAt: 1, maxRetriesPerStep: 3, steps: [],
    goal: { id: 'g', text: 'build', acceptanceCriteria: [], createdAt: 1 },
    orchestration: {
      schemaVersion: 2, enabled: true, state, evidence: [], repairRound: 0, maxRepairRounds: 2, warnings: [],
      assignments: {
        planner: { role: 'planner', providerId: 'p', modelId: 'plan' },
        builder: { role: 'builder', providerId: 'p', modelId: 'build' },
        verifier: { role: 'verifier', providerId: 'p', modelId: 'verify' },
      },
    },
  }
}

describe('getActiveRoleModel', () => {
  test('selects the model for the current orchestration phase', () => {
    expect(getActiveRoleModel(session('ideating'), 'p')).toMatchObject({ ok: true, role: 'planner', modelId: 'plan' })
    expect(getActiveRoleModel(session('drafting_plan'), 'p')).toMatchObject({ ok: true, role: 'planner', modelId: 'plan' })
    expect(getActiveRoleModel(session('building'), 'p')).toMatchObject({ ok: true, role: 'builder', modelId: 'build' })
    expect(getActiveRoleModel(session('verifying'), 'p')).toMatchObject({ ok: true, role: 'verifier', modelId: 'verify' })
  })

  test('refuses to cross provider boundaries', () => {
    expect(getActiveRoleModel(session('building'), 'other')).toMatchObject({ ok: false })
  })
})
