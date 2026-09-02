import type { AgentSession, OrchestrationRole, SpecialistRole } from './types.js'

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

export function buildOrchestrationHandoff(
  session: AgentSession,
  to: OrchestrationRole,
): string {
  const orchestration = session.orchestration
  if (!orchestration) return ''
  const evidence = orchestration.evidence
    .map(item => [
      `### ${item.role} evidence · ${item.modelId}`,
      item.summary || '(no summary supplied)',
      item.filesChanged.length ? `Files: ${item.filesChanged.join(', ')}` : '',
      item.commands.length ? `Commands: ${item.commands.join(' · ')}` : '',
      item.failures.length ? `Failures: ${item.failures.join(' · ')}` : '',
    ].filter(Boolean).join('\n'))
    .join('\n\n')
  const rules =
    to === 'planner'
      ? orchestration.state === 'ideating' || orchestration.state === 'awaiting_idea'
        ? 'Inspect only enough evidence to offer 2–3 real approaches with concise tradeoffs and one recommendation. Do not edit files.'
        : 'Turn the accepted direction into a concrete file, step, and verification plan. Do not edit files or run destructive commands.'
      : to === 'builder'
        ? 'Implement the accepted plan with real tools. Preserve raw file and command evidence for verification.'
        : 'Independently inspect the actual diff and raw test/build output. Do not trust the builder summary as proof.'
  return [
    `## Orchestration handoff → ${to}`,
    rules,
    evidence ? '\n## Prior evidence\n' + evidence : '',
  ].filter(Boolean).join('\n')
}
