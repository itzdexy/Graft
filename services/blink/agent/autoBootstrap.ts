import { getCwd } from '../../../utils/cwd.js'
import { isImplementationRequest } from '../intent/buildIntent.js'
import { resolveBlinkIntent } from '../intent/router.js'
import { AgentManager } from './AgentManager.js'
import { formatPlanForPrompt } from './TaskPlanner.js'
import type { AgentSession } from './types.js'
import { loadAgentSession, saveAgentSession } from './persistence.js'

const IDLE_AGENT_PHASES = new Set(['done', 'failed', 'paused'])

export function hasActiveBlinkAgentSession(cwd: string = getCwd()): boolean {
  const session = loadAgentSession(cwd)
  return !!session && !IDLE_AGENT_PHASES.has(session.phase)
}

export function shouldAutoBootstrapAgent(prompt: string): boolean {
  const trimmed = prompt.trim()
  if (!trimmed || trimmed.startsWith('/')) return false
  if (isImplementationRequest(trimmed)) return true
  const intent = resolveBlinkIntent(trimmed)
  return intent.preferAgentLoop
}

function normalizeGoal(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

function sessionMatchesGoal(session: AgentSession, prompt: string): boolean {
  const goal = normalizeGoal(session.goal.text)
  const next = normalizeGoal(prompt)
  if (goal === next) return true
  if (next.includes(goal) || goal.includes(next)) return true
  return false
}

const CASUAL_CHAT_RE =
  /^(hi|hello|hey|yo|sup|thanks|thank you|thx|ok|okay|cool|great|bye|good (morning|afternoon|evening)|how are you|what can you do\??|help)\.?$/i

/** True when the agent plan/HUD should show for this transcript. */
export function isAgentSessionRelevantToPrompt(
  prompt: string | null | undefined,
  cwd: string = getCwd(),
): boolean {
  const session = loadAgentSession(cwd)
  if (!session || IDLE_AGENT_PHASES.has(session.phase)) return false
  const text = prompt?.trim()
  if (!text) return false
  if (CASUAL_CHAT_RE.test(text)) return false
  if (shouldAutoBootstrapAgent(text)) return true
  if (sessionMatchesGoal(session, text)) return true
  // Continuations while a mission is live ("keep going", "fix the tests")
  if (
    /\b(continue|keep going|resume|next|fix|verify|implement|build|write|code)\b/i.test(
      text,
    )
  ) {
    return true
  }
  return false
}

/**
 * Pause a live agent mission when the user switches to casual chat so the
 * plan/HUD and system-prompt mission brief do not leak into "hi".
 */
export function pauseAgentSessionIfCasual(
  prompt: string,
  cwd: string = getCwd(),
): void {
  const session = loadAgentSession(cwd)
  if (!session || IDLE_AGENT_PHASES.has(session.phase)) return
  if (isAgentSessionRelevantToPrompt(prompt, cwd)) return
  session.phase = 'paused'
  session.updatedAt = Date.now()
  saveAgentSession(session)
}

/**
 * Start or resume a persisted /agent session for natural-language goals so the
 * main REPL loop runs with plan, verify, and autofix — not a single-shot chat.
 */
export function ensureAgentSessionForPrompt(
  prompt: string,
  cwd: string = getCwd(),
): AgentSession | null {
  if (!shouldAutoBootstrapAgent(prompt)) return null

  const existing = loadAgentSession(cwd)
  if (
    existing &&
    existing.phase !== 'done' &&
    existing.phase !== 'failed' &&
    sessionMatchesGoal(existing, prompt)
  ) {
    const step = existing.steps[existing.currentStepIndex]
    if (step && step.status === 'pending') {
      step.status = 'in_progress'
    }
    if (existing.phase === 'paused') {
      existing.phase = 'execute'
    }
    existing.updatedAt = Date.now()
    saveAgentSession(existing)
    return existing
  }

  const manager = new AgentManager(cwd)
  const session = manager.start(prompt.trim(), { autoFix: true })
  const step = session.steps[session.currentStepIndex]
  if (step) {
    step.status = 'in_progress'
  }
  session.phase = 'execute'
  session.updatedAt = Date.now()
  saveAgentSession(session)
  return session
}

/** Compact agent brief for system prompt injection each turn. */
export function formatAgentSessionSystemSection(session: AgentSession): string {
  const step = session.steps[session.currentStepIndex]
  const done = session.steps.filter(s => s.status === 'done').length
  const lines = [
    '# Active agent mission (autonomous loop)',
    `Goal: ${session.goal.text}`,
    `Phase: ${session.phase} · Progress: ${done}/${session.steps.length} steps`,
    `Current step (${session.currentStepIndex + 1}/${session.steps.length}): ${step?.title ?? 'n/a'}`,
    step?.description ? step.description : '',
    '',
    'Operate autonomously: Observe → Think → Plan → Execute → Verify → Reflect → Continue.',
    'Use Write/Edit/Bash/Read/Grep tools immediately — never paste deliverables in chat only.',
    'When the current step is finished, output exactly:',
    '### Step complete',
    '- Summary',
    '- Files touched',
    '- Verification output',
    session.autoFix
      ? 'Auto-fix is ON: after edits, run verify/test commands and fix failures before marking complete.'
      : '',
    '',
    '## Plan',
    formatPlanForPrompt(session.steps),
  ]
  return lines.filter(Boolean).join('\n')
}

/** Short user-visible notice when agent mode boots for a natural-language goal. */
export function formatAgentBootstrapNotice(session: AgentSession): string {
  const step = session.steps[session.currentStepIndex]
  const parts = [
    `**Agent mode** — working on: ${session.goal.text}`,
    `Step ${session.currentStepIndex + 1}/${session.steps.length}: ${step?.title ?? 'start'}`,
  ]
  if (session.autoFix) parts.push('Auto-fix enabled (verify loop).')
  parts.push('Use `/agent status` for the full plan.')
  return parts.join(' · ')
}
