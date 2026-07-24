import type { AgentSession, SpecialistRole } from './types.js'

const HANDOFF_ORDER: SpecialistRole[] = [
  'planner',
  'research',
  'browser',
  'memory',
  'coder',
  'debugger',
  'devops',
  'benchmark',
  'reviewer',
  'coordinator',
]

export function nextSpecialistRole(session: AgentSession): SpecialistRole | null {
  const step = session.steps[session.currentStepIndex]
  return step?.specialist ?? null
}

export function previousSpecialistRole(session: AgentSession): SpecialistRole | null {
  const idx = session.currentStepIndex - 1
  if (idx < 0) return null
  return session.steps[idx]?.specialist ?? null
}

/** Brief for handing work from one specialist phase to the next. */
export function buildSpecialistHandoff(
  session: AgentSession,
  from: SpecialistRole,
  to: SpecialistRole,
): string {
  const done = session.steps.filter(s => s.status === 'done')
  const lastDone = done[done.length - 1]
  const nextStep = session.steps[session.currentStepIndex]

  const lines = [
    `## Handoff: ${from} → ${to}`,
    '',
    'The previous specialist phase is complete. Continue with the next role\'s constraints.',
  ]

  if (lastDone) {
    lines.push('', `**From ${from}:** ${lastDone.title} — carry forward decisions and file paths mentioned.`)
  }

  if (nextStep) {
    lines.push('', `**${to} task:** ${nextStep.title}`, nextStep.description)
  }

  switch (to) {
    case 'coder':
      lines.push(
        '',
        '- Implement only what the plan specifies; no drive-by refactors.',
        '- Run Read before Edit; match existing style.',
      )
      break
    case 'reviewer':
      lines.push(
        '',
        '- Review diffs for bugs, security, and missing tests.',
        '- Cite file:line; do not rewrite unless blocking.',
      )
      break
    case 'debugger':
      lines.push(
        '',
        '- Reproduce failure with Bash; fix root cause, not symptoms.',
        '- Re-run the smallest failing test after each fix.',
      )
      break
    case 'planner':
      lines.push('', '- Update plan if scope changed; do not implement yet.')
      break
    case 'coordinator':
      lines.push('', '- Synthesize specialist outputs; resolve conflicts before closing.')
      break
    default:
      break
  }

  return lines.join('\n')
}

export function formatSpecialistPipeline(): string {
  return HANDOFF_ORDER.map((r, i) => `${i + 1}. ${r}`).join(' → ')
}
