import { randomUUID } from 'crypto'
import type { AgentGoal, AgentSession, AgentStep } from './types.js'
import { DEFAULT_MAX_RETRIES } from './types.js'

export function createGoal(text: string, acceptanceCriteria: string[] = []): AgentGoal {
  const trimmed = text.trim()
  const criteria =
    acceptanceCriteria.length > 0
      ? acceptanceCriteria
      : inferAcceptanceCriteria(trimmed)
  return {
    id: randomUUID(),
    text: trimmed,
    acceptanceCriteria: criteria,
    createdAt: Date.now(),
  }
}

/** Heuristic acceptance criteria when the user does not supply any. */
export function inferAcceptanceCriteria(goalText: string): string[] {
  const lower = goalText.toLowerCase()
  const criteria: string[] = ['Task completes without breaking existing tests or lint']

  if (lower.includes('test') || lower.includes('fix')) {
    criteria.push('Relevant tests pass')
  }
  if (lower.includes('refactor')) {
    criteria.push('Behavior unchanged; code is simpler or clearer')
  }
  if (lower.includes('dashboard') || lower.includes('ui') || lower.includes('page')) {
    criteria.push('UI renders and matches stated requirements')
  }
  if (lower.includes('api') || lower.includes('endpoint')) {
    criteria.push('API contract documented or matches existing patterns')
  }
  criteria.push('Changes are minimal and match project conventions')
  return criteria
}

export function createSession(cwd: string, goalText: string, steps: AgentStep[]): AgentSession {
  const goal = createGoal(goalText)
  return {
    id: randomUUID(),
    cwd,
    goal,
    phase: 'observe',
    steps,
    currentStepIndex: 0,
    reflections: [],
    contextNotes: [],
    startedAt: Date.now(),
    updatedAt: Date.now(),
    maxRetriesPerStep: DEFAULT_MAX_RETRIES,
    loop: {
      turnCount: 0,
      toolCallCount: 0,
      startedAt: Date.now(),
      repeatedFailureCount: 0,
      emptyOutputCount: 0,
    },
  }
}

export function markGoalComplete(session: AgentSession): AgentSession {
  return {
    ...session,
    goal: { ...session.goal, completedAt: Date.now() },
    phase: 'done',
    updatedAt: Date.now(),
  }
}

export function formatGoalStatus(session: AgentSession): string {
  const done = session.steps.filter(s => s.status === 'done').length
  const total = session.steps.length
  const lines = [
    `Goal: ${session.goal.text}`,
    `Phase: ${session.phase}`,
    `Progress: ${done}/${total} steps`,
    '',
    'Acceptance criteria:',
    ...session.goal.acceptanceCriteria.map(c => `- ${c}`),
    '',
    'Steps:',
    ...session.steps.map((s, i) => {
      const marker = i === session.currentStepIndex ? '→' : ' '
      return `${marker} [${s.status}] ${s.title}`
    }),
  ]
  if (session.reflections.length) {
    lines.push('', 'Recent reflections:', ...session.reflections.slice(-3).map(r => `- ${r}`))
  }
  return lines.join('\n')
}
