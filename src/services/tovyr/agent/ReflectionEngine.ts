import type { AgentSession, AgentStep } from './types.js'

export type ReflectionResult = {
  summary: string
  shouldRetry: boolean
  shouldAdvance: boolean
  hints: string[]
}

export function reflectOnStep(
  session: AgentSession,
  step: AgentStep,
  outcome: 'success' | 'partial' | 'failure',
  notes: string,
): ReflectionResult {
  const hints: string[] = []
  let shouldRetry = false
  let shouldAdvance = false

  switch (outcome) {
    case 'success':
      shouldAdvance = true
      hints.push('Mark step complete and move to the next phase in the loop.')
      break
    case 'partial':
      shouldAdvance = step.attempts >= session.maxRetriesPerStep
      shouldRetry = !shouldAdvance
      hints.push('Identify what is missing before advancing.')
      if (shouldRetry) {
        hints.push(`Retry attempt ${step.attempts + 1}/${session.maxRetriesPerStep}.`)
      }
      break
    case 'failure':
      shouldRetry = step.attempts < session.maxRetriesPerStep
      shouldAdvance = !shouldRetry
      hints.push('Diagnose root cause; avoid repeating the same failed approach.')
      if (!shouldRetry) {
        hints.push('Max retries reached — escalate to user or simplify scope.')
      }
      break
  }

  const summary = [
    `Reflection on "${step.title}": ${outcome}`,
    notes.trim() || '(no notes)',
    ...hints.map(h => `→ ${h}`),
  ].join('\n')

  return { summary, shouldRetry, shouldAdvance, hints }
}

export function buildReflectionPrompt(session: AgentSession): string {
  const step = session.steps[session.currentStepIndex]
  if (!step) return 'No active step to reflect on.'

  return [
    '## Reflection (required before continuing)',
    `Current step: ${step.title}`,
    `Attempts so far: ${step.attempts}`,
    '',
    'Answer briefly:',
    '1. What was accomplished?',
    '2. What failed or is uncertain?',
    '3. Does this step meet its description? If not, what is left?',
    '4. Should we retry, advance, or ask the user?',
    '',
    'If verify step: paste test/lint/build results.',
    'If durable project facts emerged, add `## Memory updates` bullets for Buddy.',
  ].join('\n')
}

export function appendReflection(session: AgentSession, text: string): AgentSession {
  const trimmed = text.trim()
  if (!trimmed) return session
  return {
    ...session,
    reflections: [...session.reflections, trimmed].slice(-20),
    updatedAt: Date.now(),
  }
}
