import type { AgentSession } from '../agent/types.js'
import type { ScannedToolUse } from './messageScanner.js'
import type { TimelineEvent, ToolActivityEntry } from './types.js'

export function buildTaskTimeline(
  session: AgentSession,
  toolActivities: ToolActivityEntry[] = [],
  scannedTools: ScannedToolUse[] = [],
): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      at: session.startedAt,
      kind: 'session',
      label: 'Session started',
      detail: session.goal.text,
    },
  ]

  for (const [i, step] of session.steps.entries()) {
    const at = step.completedAt ?? session.startedAt + i
    events.push({
      at,
      kind: 'step',
      label: `Step ${i + 1}: ${step.title}`,
      detail: `[${step.status}]${step.lastError ? ` ${step.lastError}` : ''}`,
    })
  }

  for (const reflection of session.reflections) {
    events.push({
      at: session.updatedAt,
      kind: 'reflection',
      label: 'Reflection',
      detail: reflection,
    })
  }

  if (session.autoFix) {
    events.push({
      at: session.updatedAt,
      kind: 'verify',
      label: 'Auto-fix enabled',
      detail: `round ${session.autoFixRound ?? 0}/${session.maxAutoFixRounds ?? 5}`,
    })
  }

  for (const t of toolActivities) {
    events.push({
      at: t.at,
      kind: 'tool',
      label: t.toolName,
      detail: `${t.ok ? 'ok' : 'fail'}${t.summary ? ` - ${t.summary}` : ''}`,
    })
  }

  for (const t of scannedTools) {
    if (t.at == null) continue
    events.push({
      at: t.at,
      kind: 'tool',
      label: t.name,
      detail: t.summary || undefined,
    })
  }

  events.push({
    at: session.updatedAt,
    kind: 'phase',
    label: `Current phase: ${session.phase}`,
    detail: formatAgentStepPointer(session),
  })

  return events.sort((a, b) => a.at - b.at)
}

function formatAgentStepPointer(session: AgentSession): string {
  const step = session.steps[session.currentStepIndex]
  if (!step) return ''
  return `-> ${step.title} [${step.status}]`
}

export function formatTimelineMarkdown(events: TimelineEvent[]): string {
  if (events.length === 0) return '_No timeline events._'
  const lines = ['# Agent timeline', '']
  for (const e of events) {
    const time = new Date(e.at).toISOString().slice(11, 19)
    const detail = e.detail ? ` - ${e.detail}` : ''
    lines.push(`- \`${time}\` **${e.kind}** ${e.label}${detail}`)
  }
  return lines.join('\n')
}

export function formatTimelineForAgent(session: AgentSession): string {
  const events = buildTaskTimeline(session)
  return formatTimelineMarkdown(events)
}
