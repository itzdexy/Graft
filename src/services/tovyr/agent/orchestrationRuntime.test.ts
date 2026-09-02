import { describe, expect, test } from 'bun:test'
import {
  applyOrchestrationOutput,
  applyOrchestrationUserInput,
} from './orchestrationRuntime.js'
import type { AgentSession } from './types.js'

function makeSession(state: NonNullable<AgentSession['orchestration']>['state']): AgentSession {
  return {
    id: 's', cwd: '/x', phase: 'plan', currentStepIndex: 0, reflections: [], contextNotes: [],
    startedAt: 1, updatedAt: 1, maxRetriesPerStep: 3, steps: [],
    goal: { id: 'g', text: 'build', acceptanceCriteria: [], createdAt: 1 },
    orchestration: {
      schemaVersion: 2, enabled: true, state, evidence: [], repairRound: 0, maxRepairRounds: 2, warnings: [],
      approvalPolicy: 'ideas-and-plan',
      assignments: {
        planner: { role: 'planner', providerId: 'p', modelId: 'plan' },
        builder: { role: 'builder', providerId: 'p', modelId: 'build' },
        verifier: { role: 'verifier', providerId: 'p', modelId: 'verify' },
      },
    },
  }
}

describe('applyOrchestrationOutput', () => {
  test('stops after ideation so the user can choose an approach', () => {
    const result = applyOrchestrationOutput(makeSession('ideating'), 'Three approaches\n### Ideas ready', true)
    expect(result.advanced).toBe(true)
    expect(result.session.orchestration?.state).toBe('awaiting_idea')
  })

  test('keeps a completed plan at its approval checkpoint in code mode', () => {
    const result = applyOrchestrationOutput(makeSession('drafting_plan'), 'Plan details\n### Plan ready', true)
    expect(result.advanced).toBe(true)
    expect(result.session.orchestration?.state).toBe('awaiting_plan')
    expect(result.session.phase).toBe('plan')
  })

  test('hands completed builds to verifier and records evidence', () => {
    const result = applyOrchestrationOutput(makeSession('building'), 'Changed src/a.ts\n### Build complete', true)
    expect(result.session.orchestration?.state).toBe('verifying')
    expect(result.session.orchestration?.evidence[0]).toMatchObject({ role: 'builder', modelId: 'build' })
  })

  test('completes only on explicit verifier approval', () => {
    const result = applyOrchestrationOutput(makeSession('verifying'), 'Tests pass\n### Verification approved', true)
    expect(result.session.phase).toBe('done')
    expect(result.session.orchestration?.state).toBe('complete')
  })

  test('only treats a standalone final nonempty line as a stage marker', () => {
    const embedded = [
      'I will finish with ### Ideas ready once the options are complete.',
      '### Ideas ready\nI still need to compare the tradeoffs.',
      '> ### Ideas ready',
      'Say `### Ideas ready` when finished.',
      'Example output:\n```md\n### Ideas ready',
    ]

    for (const text of embedded) {
      const result = applyOrchestrationOutput(makeSession('ideating'), text, true)
      expect(result.advanced).toBe(false)
      expect(result.session.orchestration?.state).toBe('ideating')
      expect(result.session.orchestration?.evidence).toHaveLength(0)
    }

    const completed = applyOrchestrationOutput(
      makeSession('ideating'),
      'Three approaches with tradeoffs.\n### Ideas ready\n\n',
      true,
    )
    expect(completed.advanced).toBe(true)
    expect(completed.session.orchestration?.state).toBe('awaiting_idea')
  })

  test('accepts plain concise approvals and preserves their direction', () => {
    const idea = applyOrchestrationUserInput(
      makeSession('awaiting_idea'),
      'Use the recommended approach.',
    )
    expect(idea.accepted).toBe(true)
    expect(idea.session.orchestration?.state).toBe('drafting_plan')
    expect(idea.session.contextNotes.at(-1)).toContain('recommended')

    const plan = applyOrchestrationUserInput(
      makeSession('awaiting_plan'),
      'yes, build it',
    )
    expect(plan.accepted).toBe(true)
    expect(plan.session.orchestration?.state).toBe('building')
    expect(plan.session.phase).toBe('execute')
  })

  test('accepts natural concise plan approvals', () => {
    for (const input of [
      'looks good',
      'sounds good',
      'go ahead',
      'do it',
      'proceed',
    ]) {
      const result = applyOrchestrationUserInput(
        makeSession('awaiting_plan'),
        input,
      )
      expect(result.accepted).toBe(true)
      expect(result.session.orchestration?.state).toBe('building')
    }
  })

  test('routes qualified approvals and revision cues back to ideation', () => {
    for (const input of [
      "yes, but don't use React",
      'change the second option to use a local database',
      'use vanilla TypeScript instead',
      'none of these—give me more options',
      'Could you use Vue instead?',
    ]) {
      const revised = applyOrchestrationUserInput(
        makeSession('awaiting_idea'),
        input,
      )
      expect(revised.handled).toBe(true)
      expect(revised.accepted).toBe(false)
      expect(revised.session.orchestration?.state).toBe('ideating')
      expect(revised.session.contextNotes.at(-1)).toContain(input)
    }
  })

  test('routes qualified approvals and revision cues back to plan drafting', () => {
    for (const input of [
      "okay, but don't use React",
      'change the verification command',
      'use Bun instead',
      'none of this—write a smaller plan',
    ]) {
      const revised = applyOrchestrationUserInput(
        makeSession('awaiting_plan'),
        input,
      )
      expect(revised.handled).toBe(true)
      expect(revised.accepted).toBe(false)
      expect(revised.session.orchestration?.state).toBe('drafting_plan')
      expect(revised.session.contextNotes.at(-1)).toContain(input)
    }
  })

  test('routes plan edits back to the planner instead of building stale work', () => {
    const revised = applyOrchestrationUserInput(
      makeSession('awaiting_plan'),
      'Move verification before the packaging step.',
    )
    expect(revised.handled).toBe(true)
    expect(revised.accepted).toBe(false)
    expect(revised.session.orchestration?.state).toBe('drafting_plan')
    expect(revised.session.contextNotes.at(-1)).toContain('verification')
  })
})
