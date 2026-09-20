import { describe, expect, test } from 'bun:test'
import type { AgentSession } from '../agent/types.js'
import {
  isAgentSessionPromptRelevant,
  selectVisibleOrchestration,
} from './orchestrationVisibility.js'

const session = {
  id: 'session',
  cwd: '/project',
  goal: { id: 'goal', text: 'build a site', acceptanceCriteria: [], createdAt: 1 },
  phase: 'plan' as const,
  steps: [],
  currentStepIndex: 0,
  reflections: [],
  contextNotes: [],
  startedAt: 1,
  updatedAt: 1,
  maxRetriesPerStep: 2,
  orchestration: {
    schemaVersion: 2 as const,
    enabled: true as const,
    state: 'awaiting_idea' as const,
    evidence: [],
    repairRound: 0,
    maxRepairRounds: 2,
    warnings: [],
    assignments: {
      planner: { role: 'planner' as const, providerId: 'anthropic', modelId: 'claude-opus-5' },
      builder: { role: 'builder' as const, providerId: 'anthropic', modelId: 'claude-sonnet-5' },
      verifier: { role: 'verifier' as const, providerId: 'anthropic', modelId: 'claude-haiku-5' },
    },
  },
} satisfies AgentSession

describe('selectVisibleOrchestration', () => {
  test('keeps active approval checkpoints visible', () => {
    expect(selectVisibleOrchestration(session, true)?.state).toBe('awaiting_idea')
  })

  test('hides a stale rail for unrelated chat and idle sessions', () => {
    expect(selectVisibleOrchestration(session, false)).toBeUndefined()
    expect(selectVisibleOrchestration({ ...session, phase: 'paused' }, true)).toBeUndefined()
    expect(selectVisibleOrchestration({ ...session, phase: 'done' }, true)).toBeUndefined()
  })

  test('hides completed orchestration', () => {
    expect(selectVisibleOrchestration({
      ...session,
      orchestration: { ...session.orchestration, state: 'complete' },
    }, true)).toBeUndefined()
  })
})

describe('agent session prompt relevance', () => {
  test('classifies prompts against the provided session', () => {
    expect(isAgentSessionPromptRelevant(session, 'build a site')).toBe(true)
    expect(
      isAgentSessionPromptRelevant(session, 'compare the approaches?'),
    ).toBe(true)
    expect(isAgentSessionPromptRelevant(session, 'ok')).toBe(true)
  })

  test('keeps active orchestration visible after a handled approval', () => {
    const building = {
      ...session,
      phase: 'execute' as const,
      orchestration: { ...session.orchestration, state: 'building' as const },
    }
    expect(isAgentSessionPromptRelevant(building, 'ok')).toBe(true)
  })

  test('hides casual prompts when persistence marks the mission unrelated', () => {
    expect(
      isAgentSessionPromptRelevant({ ...session, orchestration: undefined }, 'hi'),
    ).toBe(false)
    expect(
      isAgentSessionPromptRelevant({ ...session, phase: 'paused' }, 'ok'),
    ).toBe(false)
  })
})
