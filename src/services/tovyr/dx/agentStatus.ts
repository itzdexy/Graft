import type { AgentSession } from '../agent/types.js'
import { getLastToolLabel, type ScannedToolUse } from './messageScanner.js'
import type { ToolActivityEntry } from './types.js'

type ScannableMessage = Parameters<typeof getLastToolLabel>[0][number]

export function shouldShowAgentHud(session: AgentSession | null): boolean {
  if (!session) return false
  return session.phase !== 'done' && session.phase !== 'failed'
}

export function truncateMiddle(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max - 3)}...`
}

export function formatAgentHudLine(
  session: AgentSession,
  lastToolLabel: string | null,
): string {
  const step = session.steps[session.currentStepIndex]
  const done = session.steps.filter(s => s.status === 'done').length
  const total = session.steps.length
  const parts = [`Agent ${done}/${total}`]
  if (step?.title) parts.push(truncateMiddle(step.title, 40))
  if (lastToolLabel) parts.push(`-> ${truncateMiddle(lastToolLabel, 28)}`)
  if (session.autoFix) {
    parts.push(`autofix ${session.autoFixRound ?? 0}/${session.maxAutoFixRounds ?? 5}`)
  }
  return parts.join(' · ')
}

export function formatAgentStatusCompact(session: AgentSession): string {
  const done = session.steps.filter(s => s.status === 'done').length
  return `${session.phase} * ${done}/${session.steps.length} * ${truncateMiddle(session.goal.text, 48)}`
}

export function computeTovyrHud(
  session: AgentSession | null,
  messages: ScannableMessage[],
): string | null {
  if (!shouldShowAgentHud(session) || !session) return null
  const lastTool = getLastToolLabel(messages) ?? null
  return formatAgentHudLine(session, lastTool)
}

export function formatToolActivityLines(entries: ToolActivityEntry[]): string[] {
  return entries.map(e => {
    const status = e.ok ? 'ok' : 'fail'
    const ms = e.durationMs != null ? ` ${e.durationMs}ms` : ''
    const detail = e.summary ? ` - ${e.summary}` : ''
    return `- [${status}${ms}] ${e.toolName}${detail}`
  })
}

export function formatScannedToolLines(tools: ScannedToolUse[]): string[] {
  return tools.map(t => {
    const detail = t.summary ? ` - ${t.summary}` : ''
    return `- ${t.name}${detail}`
  })
}
