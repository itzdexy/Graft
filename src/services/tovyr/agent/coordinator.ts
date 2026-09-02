import type { AgentSession, AgentStep } from './types.js'
import { getSpecialistInstructions } from './specialists.js'

export type CoordinatorConflict = {
  stepId: string
  issue: string
  resolution: string
}

/** Merge specialist step outputs and surface conflicts for the orchestrator. */
export function buildCoordinatorBrief(session: AgentSession): string {
  const done = session.steps.filter(s => s.status === 'done')
  const blocked = session.steps.filter(s => s.status === 'failed')
  const pending = session.steps.filter(s => s.status === 'pending' || s.status === 'in_progress')

  const lines = [
    '# Coordinator brief',
    '',
    `Goal: ${session.goal.text}`,
    `Phase: ${session.phase}`,
    '',
    getSpecialistInstructions('coordinator'),
    '',
    '## Step status',
    `- Done: ${done.length}`,
    `- Blocked/failed: ${blocked.length}`,
    `- Remaining: ${pending.length}`,
  ]

  if (blocked.length) {
    lines.push('', '## Blockers (resolve before continuing)')
    for (const s of blocked) {
      lines.push(`- **${s.title}** (${s.specialist ?? 'general'}): ${s.lastError ?? 'failed'}`)
    }
  }

  const conflicts = detectStepConflicts(session.steps)
  if (conflicts.length) {
    lines.push('', '## Conflicts')
    for (const c of conflicts) {
      lines.push(`- ${c.issue} → ${c.resolution}`)
    }
  }

  if (done.length) {
    lines.push('', '## Completed outputs (synthesize, do not paste raw)')
    for (const s of done.slice(-5)) {
      lines.push(`- ${s.title}${s.lastError ? ` (note: ${s.lastError})` : ''}`)
    }
  }

  lines.push(
    '',
    '## Next action',
    pending[0]
      ? `Execute step: **${pending[0].title}** via ${pending[0].specialist ?? 'coder'} specialist.`
      : blocked.length
        ? 'Unblock failed steps or revise the plan with the user.'
        : 'Run verify, then mark the goal complete.',
  )

  return lines.join('\n')
}

export function detectStepConflicts(steps: AgentStep[]): CoordinatorConflict[] {
  const conflicts: CoordinatorConflict[] = []
  const coderDone = steps.find(s => s.specialist === 'coder' && s.status === 'done')
  const reviewerFailed = steps.find(s => s.specialist === 'reviewer' && s.status === 'failed')

  if (coderDone && reviewerFailed) {
    conflicts.push({
      stepId: reviewerFailed.id,
      issue: 'Reviewer rejected coder output',
      resolution: 'Send reviewer feedback to coder step; fix before marking goal done.',
    })
  }

  const verifyFailed = steps.find(
    s => s.title.toLowerCase().includes('verify') && s.status === 'failed',
  )
  if (verifyFailed) {
    conflicts.push({
      stepId: verifyFailed.id,
      issue: 'Verification failed',
      resolution: 'Run /agent autofix or debugger specialist before continue.',
    })
  }

  return conflicts
}
