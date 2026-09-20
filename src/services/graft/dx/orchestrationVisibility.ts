import type { AgentOrchestration, AgentSession } from '../agent/types.js'
import { isImplementationRequest } from '../intent/buildIntent.js'
import { resolveGraftIntent } from '../intent/router.js'

const HIDDEN_AGENT_PHASES = new Set<AgentSession['phase']>([
  'done',
  'failed',
  'paused',
])

const CASUAL_CHAT_RE =
  /^(hi|hello|hey|yo|sup|thanks|thank you|thx|ok|okay|cool|great|bye|good (morning|afternoon|evening)|how are you|what can you do\??|help)\.?$/i

function normalizeGoal(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

function startsAgentMission(prompt: string): boolean {
  if (prompt.startsWith('/')) return false
  return isImplementationRequest(prompt) || resolveGraftIntent(prompt).preferAgentLoop
}

/** Pure prompt/session classifier for render paths that already have a snapshot. */
export function isAgentSessionPromptRelevant(
  session: AgentSession | null | undefined,
  prompt: string | null | undefined,
): boolean {
  if (!session || HIDDEN_AGENT_PHASES.has(session.phase)) return false
  const text = prompt?.trim()
  if (!text) return false
  if (
    session.orchestration !== undefined &&
    session.orchestration.state !== 'complete'
  ) {
    return true
  }
  if (CASUAL_CHAT_RE.test(text)) return false
  if (startsAgentMission(text)) return true
  const goal = normalizeGoal(session.goal.text)
  const next = normalizeGoal(text)
  if (goal === next || next.includes(goal) || goal.includes(next)) return true
  return /\b(continue|keep going|resume|next|fix|verify|implement|build|write|code)\b/i.test(
    text,
  )
}

/** Keep the rail tied to the live mission instead of leaking into unrelated chat. */
export function selectVisibleOrchestration(
  session: AgentSession | null | undefined,
  promptRelevant: boolean,
): AgentOrchestration | undefined {
  if (!session || HIDDEN_AGENT_PHASES.has(session.phase) || !promptRelevant) {
    return undefined
  }
  if (!session.orchestration || session.orchestration.state === 'complete') {
    return undefined
  }
  return session.orchestration
}
