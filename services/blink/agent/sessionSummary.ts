import type { AgentSession } from './types.js'

export type SessionSummary = {
  headline: string
  goalStatus: 'completed' | 'failed' | 'in_progress' | 'paused'
  stepsDone: number
  stepsTotal: number
  stepsFailed: number
  filesTouched: string[]
  verificationNotes: string[]
  blockers: string[]
  body: string
}

function extractFilesFromReflections(session: AgentSession): string[] {
  const files = new Set<string>()
  const pathRe = /(?:^|\s)([\w./\\-]+\.(?:ts|tsx|js|jsx|py|go|rs|md|json|yaml|yml|toml|css|html))\b/gi
  for (const r of session.reflections) {
    let m: RegExpExecArray | null
    while ((m = pathRe.exec(r)) !== null) {
      files.add(m[1]!)
    }
  }
  return [...files].slice(0, 20)
}

function goalStatus(session: AgentSession): SessionSummary['goalStatus'] {
  if (session.phase === 'done' || session.goal.completedAt) return 'completed'
  if (session.phase === 'failed') return 'failed'
  if (session.phase === 'paused') return 'paused'
  return 'in_progress'
}

/** Accurate session summary from persisted state (not model prose). */
export function buildSessionSummary(session: AgentSession): SessionSummary {
  const done = session.steps.filter(s => s.status === 'done')
  const failed = session.steps.filter(s => s.status === 'failed')
  const status = goalStatus(session)
  const current = session.steps[session.currentStepIndex]

  const verificationNotes: string[] = []
  for (const s of session.steps) {
    if (!s.title.toLowerCase().includes('verify')) continue
    if (s.status === 'done') verificationNotes.push(`Verify step passed: ${s.title}`)
    if (s.status === 'failed') {
      verificationNotes.push(`Verify failed: ${s.title}${s.lastError ? ` — ${s.lastError}` : ''}`)
    }
  }

  const blockers = failed.map(
    s => `${s.title}${s.lastError ? `: ${s.lastError}` : ''}`,
  )
  if (session.loop?.stopMessage) {
    blockers.push(session.loop.stopMessage)
  }

  const headline =
    status === 'completed'
      ? `Goal completed (${done.length}/${session.steps.length} steps)`
      : status === 'failed'
        ? `Goal blocked (${done.length}/${session.steps.length} steps done)`
        : `In progress — step ${session.currentStepIndex + 1}/${session.steps.length}`

  const lines = [
    headline,
    '',
    `Goal: ${session.goal.text}`,
    `Phase: ${session.phase}`,
    `Progress: ${done.length}/${session.steps.length} steps complete`,
  ]

  if (current && status === 'in_progress') {
    lines.push(`Current: ${current.title} (${current.specialist ?? 'general'})`)
  }

  if (session.goal.acceptanceCriteria.length) {
    lines.push('', 'Acceptance criteria:')
    for (const c of session.goal.acceptanceCriteria) {
      lines.push(`- ${c}`)
    }
  }

  if (done.length) {
    lines.push('', 'Completed steps:')
    for (const s of done) {
      lines.push(`- ${s.title}`)
    }
  }

  if (blockers.length) {
    lines.push('', 'Blockers:')
    for (const b of blockers) lines.push(`- ${b}`)
  }

  if (verificationNotes.length) {
    lines.push('', 'Verification:')
    for (const v of verificationNotes) lines.push(`- ${v}`)
  }

  if (session.reflections.length) {
    lines.push('', 'Latest reflection:')
    lines.push(session.reflections[session.reflections.length - 1]!)
  }

  const filesTouched = extractFilesFromReflections(session)

  return {
    headline,
    goalStatus: status,
    stepsDone: done.length,
    stepsTotal: session.steps.length,
    stepsFailed: failed.length,
    filesTouched,
    verificationNotes,
    blockers,
    body: lines.join('\n'),
  }
}

export function formatSessionSummaryText(session: AgentSession): string {
  return buildSessionSummary(session).body
}
