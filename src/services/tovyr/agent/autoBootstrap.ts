import { getCwd } from '../../../utils/cwd.js'
import type { PermissionMode } from '../../../types/permissions.js'
import { isImplementationRequest } from '../intent/buildIntent.js'
import { resolveTovyrIntent } from '../intent/router.js'
import { AgentManager } from './AgentManager.js'
import { formatPlanForPrompt } from './TaskPlanner.js'
import type { AgentSession } from './types.js'
import { loadAgentSession, saveAgentSession } from './persistence.js'
import { createAdaptiveOrchestration } from './adaptiveOrchestration.js'
import { applyOrchestrationUserInput } from './orchestrationRuntime.js'

const IDLE_AGENT_PHASES = new Set(['done', 'failed', 'paused'])
const READ_ONLY_ORCHESTRATION_STATES = new Set([
  'ideating',
  'awaiting_idea',
  'drafting_plan',
  'awaiting_plan',
])

/**
 * Modes the user selects deliberately to grant writes, and which the planner
 * phase must not silently take back.
 *
 * `bypassPermissions` is an explicit "I accept the consequences" — it is not a
 * default posture the orchestration is free to downgrade. Doing so made the
 * footer lie: it read `Bypass` while every turn ran as `plan`, so Write failed
 * with `mode: plan` and there was no way out. The user approving "yes, build
 * it" did not help either, because approval does not advance the orchestration
 * state out of `awaiting_plan`.
 */
const USER_OVERRIDE_MODES = new Set<PermissionMode>(['bypassPermissions'])

export function resolveAgentTurnPolicy(
  session: AgentSession,
  permissionMode: PermissionMode,
): {
  permissionMode: PermissionMode
  suppressCodeModeNotice: boolean
  /** Set when the planner phase downgraded the caller's mode. */
  plannerReadOnly?: boolean
} {
  if (
    session.orchestration &&
    READ_ONLY_ORCHESTRATION_STATES.has(session.orchestration.state) &&
    // An explicit override outranks the planner's default read-only posture.
    !USER_OVERRIDE_MODES.has(permissionMode)
  ) {
    return {
      permissionMode: 'plan',
      suppressCodeModeNotice: true,
      plannerReadOnly: true,
    }
  }
  return { permissionMode, suppressCodeModeNotice: false }
}

export function hasActiveTovyrAgentSession(cwd: string = getCwd()): boolean {
  const session = loadAgentSession(cwd)
  return !!session && !IDLE_AGENT_PHASES.has(session.phase)
}

export function shouldAutoBootstrapAgent(prompt: string): boolean {
  const trimmed = prompt.trim()
  if (!trimmed || trimmed.startsWith('/')) return false
  if (isImplementationRequest(trimmed)) return true
  const intent = resolveTovyrIntent(trimmed)
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

/**
 * Openers and sign-offs that can never be an answer to a pending approval.
 *
 * Deliberately excludes "ok"/"okay"/"cool"/"great"/"yes": those *are* how a
 * user approves a plan, and a session in awaiting_idea must still accept them.
 */
const GREETING_RE =
  /^(hi|hello|hey|yo|sup|thanks|thank you|thx|bye|good (morning|afternoon|evening)|how are you|what can you do\??|help)\.?$/i

/** True when the agent plan/HUD should show for this transcript. */
export function isAgentSessionRelevantToPrompt(
  prompt: string | null | undefined,
  cwd: string = getCwd(),
): boolean {
  const session = loadAgentSession(cwd)
  if (!session || IDLE_AGENT_PHASES.has(session.phase)) return false
  const text = prompt?.trim()
  if (!text) return false
  // Greetings are checked before the awaiting-approval states. A session
  // parked in awaiting_idea used to claim every subsequent prompt, so a bare
  // "hi" was consumed as the answer to a pending planning question and came
  // back as a three-approach execution plan.
  if (GREETING_RE.test(text)) return false
  if (
    session.orchestration?.state === 'awaiting_idea' ||
    session.orchestration?.state === 'awaiting_plan'
  ) {
    return true
  }
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
  const existing = loadAgentSession(cwd)
  // Never feed a greeting into a pending approval prompt.
  const isGreeting = GREETING_RE.test(prompt.trim())
  if (
    !isGreeting &&
    existing?.orchestration &&
    (existing.orchestration.state === 'awaiting_idea' ||
      existing.orchestration.state === 'awaiting_plan')
  ) {
    const decision = applyOrchestrationUserInput(existing, prompt)
    if (decision.handled) {
      saveAgentSession(decision.session)
      return decision.session
    }
  }

  if (!shouldAutoBootstrapAgent(prompt)) return null
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
  const orchestration = createAdaptiveOrchestration(prompt)
  if (orchestration) session.orchestration = orchestration
  session.phase = orchestration ? 'plan' : 'execute'
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
    session.orchestration?.state === 'ideating' ||
    session.orchestration?.state === 'awaiting_idea' ||
    session.orchestration?.state === 'drafting_plan' ||
    session.orchestration?.state === 'awaiting_plan'
      ? 'Planner is read-only: use Read/Grep/Web tools for evidence and do not edit files.'
      : 'Use Write/Edit/Bash/Read/Grep tools immediately — never paste deliverables in chat only.',
    session.orchestration ? '' : 'When the current step is finished, output exactly:',
    session.orchestration ? '' : '### Step complete',
    session.orchestration ? '' : '- Summary',
    session.orchestration ? '' : '- Files touched',
    session.orchestration ? '' : '- Verification output',
    session.autoFix
      ? 'Auto-fix is ON: after edits, run verify/test commands and fix failures before marking complete.'
      : '',
    '',
    '## Plan',
    formatPlanForPrompt(session.steps),
  ]
  if (session.orchestration) {
    const role =
      session.orchestration.state === 'ideating' ||
      session.orchestration.state === 'awaiting_idea' ||
      session.orchestration.state === 'drafting_plan' ||
      session.orchestration.state === 'awaiting_plan'
        ? 'planner'
        : session.orchestration.state === 'verifying'
          ? 'verifier'
          : 'builder'
    lines.splice(
      3,
      0,
      `Orchestration: ${session.orchestration.state} · Active role: ${role}`,
      session.orchestration.state === 'ideating'
        ? 'Planner is read-only. Offer 2–3 materially different approaches, recommend one, and end with exactly: ### Ideas ready'
        : session.orchestration.state === 'awaiting_idea'
          ? 'The user is reviewing approaches. Answer questions concisely; do not implement.'
          : session.orchestration.state === 'drafting_plan'
            ? 'Planner is read-only. Produce a concrete file/step/check plan ending with exactly: ### Plan ready'
            : session.orchestration.state === 'awaiting_plan'
              ? 'The user is reviewing the plan. Answer questions concisely; do not implement.'
              : role === 'verifier'
                ? 'Verifier must inspect raw diffs and command output. End with exactly: ### Verification approved, or ### Verification needs changes'
                : 'Builder must implement the accepted plan and verify its edits. End with exactly: ### Build complete',
    )
  }
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
  if (session.orchestration) {
    parts.push('Adaptive roles: IDEAS → PLAN → BUILD → VERIFY.')
    if (session.orchestration.warnings.length) parts.push(session.orchestration.warnings[0]!)
  }
  parts.push('Use `/agent status` for the full plan.')
  return parts.join(' · ')
}
