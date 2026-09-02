import type { AgentSession } from './types.js'
import { buildCoordinatorBrief } from './coordinator.js'
import { getSpecialistInstructions } from './specialists.js'

/**
 * Phase 5 — prompt for Agent tool coordinator subagent run.
 * Does not replace query(); delegates via Agent tool with conflict policy.
 */
export function buildCoordinatorAgentPrompt(session: AgentSession): string {
  const brief = buildCoordinatorBrief(session)
  return [
  '# Coordinator subagent',
  '',
  'You are the **coordinator** specialist. Synthesize specialist outputs; resolve conflicts; do not duplicate coder work.',
  '',
  getSpecialistInstructions('coordinator'),
  '',
  '## Conflict resolution policy',
  '1. Reviewer rejects coder → send specific fixes back to coder; do not mark goal done.',
  '2. Verify failed → run debugger or `/agent autofix` before continuing.',
  '3. Research vs planner disagree → prefer user-approved plan; cite evidence.',
  '4. Never spawn parallel coders on the same files.',
  '',
  brief,
  '',
  'Return: (1) synthesized status, (2) blockers, (3) exact next Agent delegation with specialist role.',
  ].join('\n')
}
