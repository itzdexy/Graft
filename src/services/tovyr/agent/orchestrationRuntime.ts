import { advanceOrchestration } from './orchestrationState.js'
import type { AgentSession, OrchestrationRole } from './types.js'
import { loadAgentSession, saveAgentSession } from './persistence.js'

function roleForState(
  state: NonNullable<AgentSession['orchestration']>['state'],
): OrchestrationRole | null {
  if (
    state === 'ideating' ||
    state === 'awaiting_idea' ||
    state === 'drafting_plan' ||
    state === 'awaiting_plan'
  )
    return 'planner'
  if (state === 'building' || state === 'needs_changes') return 'builder'
  if (state === 'verifying') return 'verifier'
  return null
}

function hasFinalMarker(text: string, marker: string): boolean {
  const lines = text.split(/\r?\n/)
  let finalIndex = lines.length - 1
  while (finalIndex >= 0 && !lines[finalIndex]?.trim()) finalIndex -= 1
  if (lines[finalIndex]?.trim().toLowerCase() !== marker.toLowerCase()) {
    return false
  }

  let insideFence = false
  for (let index = 0; index < finalIndex; index += 1) {
    if (/^\s*(?:```|~~~)/.test(lines[index] ?? '')) insideFence = !insideFence
  }
  return !insideFence
}

function stripFinalMarker(text: string): string {
  const lines = text.split(/\r?\n/)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!lines[index]?.trim()) continue
    lines.splice(index, 1)
    break
  }
  return lines.join('\n').trim()
}

export function applyOrchestrationOutput(
  session: AgentSession,
  text: string,
  autoAcceptPlan: boolean,
): { session: AgentSession; advanced: boolean } {
  const orchestration = session.orchestration
  if (!orchestration) return { session, advanced: false }
  const role = roleForState(orchestration.state)
  if (!role) return { session, advanced: false }

  let event:
    | 'ideas_ready'
    | 'plan_ready'
    | 'build_complete'
    | 'approved'
    | 'needs_changes'
    | null = null
  if (
    orchestration.state === 'ideating' &&
    hasFinalMarker(text, '### ideas ready')
  )
    event = 'ideas_ready'
  if (
    orchestration.state === 'drafting_plan' &&
    hasFinalMarker(text, '### plan ready')
  )
    event = 'plan_ready'
  if (role === 'builder' && hasFinalMarker(text, '### build complete'))
    event = 'build_complete'
  if (role === 'verifier' && hasFinalMarker(text, '### verification approved'))
    event = 'approved'
  if (
    role === 'verifier' &&
    hasFinalMarker(text, '### verification needs changes')
  )
    event = 'needs_changes'
  if (!event) return { session, advanced: false }

  const assignment = orchestration.assignments[role]
  orchestration.evidence.push({
    stepId:
      session.steps[session.currentStepIndex]?.id ??
      `${role}-${orchestration.evidence.length + 1}`,
    role,
    modelId: assignment.modelId,
    summary: stripFinalMarker(text).slice(0, 4_000),
    filesChanged: [],
    commands: [],
    failures: event === 'needs_changes' ? [text.slice(0, 2_000)] : [],
    createdAt: Date.now(),
  })

  let next = advanceOrchestration(
    orchestration.state,
    event,
    orchestration.repairRound,
    orchestration.maxRepairRounds,
  )
  if (
    next.state === 'awaiting_plan' &&
    autoAcceptPlan &&
    orchestration.approvalPolicy !== 'ideas-and-plan'
  ) {
    next = advanceOrchestration(
      next.state,
      'plan_accepted',
      next.repairRound,
      orchestration.maxRepairRounds,
    )
  }
  orchestration.state = next.state
  orchestration.repairRound = next.repairRound
  session.phase =
    next.state === 'building'
      ? 'execute'
      : next.state === 'verifying'
        ? 'verify'
        : next.state === 'complete'
          ? 'done'
          : next.state === 'blocked'
            ? 'failed'
            : 'plan'
  if (next.state === 'complete') session.goal.completedAt = Date.now()
  session.updatedAt = Date.now()
  return { session, advanced: true }
}

const ACCEPT_RE =
  /^(?:y|yes|ok(?:ay)?|go(?: ahead)?|continue|proceed|approved?|accept(?:ed)?|ship it|build it|do it|looks good|sounds good|choose (?:the )?best|use (?:the )?(?:recommended|first|second|third)|option\s*[123]|[123])\b/i
const HOLD_RE = /^(?:n|no|stop|wait|hold|not yet)\b/i
const REVISION_RE =
  /(?:^(?:please\s+)?(?:change|revise|redo)\b|^(?:can|could|would) you (?:please )?(?:change|revise|redo)\b|\b(?:but|however|instead)\b|^none of (?:these|those|this|them)\b|^(?:give|show) me (?:more|another|different)\b)/i

export function applyOrchestrationUserInput(
  session: AgentSession,
  input: string,
): { session: AgentSession; handled: boolean; accepted: boolean } {
  const orchestration = session.orchestration
  const text = input.trim()
  if (!orchestration || !text) {
    return { session, handled: false, accepted: false }
  }
  const state = orchestration.state
  if (state !== 'awaiting_idea' && state !== 'awaiting_plan') {
    return { session, handled: false, accepted: false }
  }

  if (HOLD_RE.test(text)) {
    return { session, handled: true, accepted: false }
  }

  const isRevision =
    REVISION_RE.test(text) ||
    (state === 'awaiting_plan' && !ACCEPT_RE.test(text))
  if (isRevision) {
    session.contextNotes.push(
      `${state === 'awaiting_idea' ? 'Idea' : 'Plan'} revision: ${text}`,
    )
    orchestration.state =
      state === 'awaiting_idea' ? 'ideating' : 'drafting_plan'
    session.phase = 'plan'
    session.updatedAt = Date.now()
    return { session, handled: true, accepted: false }
  }

  const isQuestion =
    text.endsWith('?') || /^(?:what|why|how|compare|explain)\b/i.test(text)
  if (isQuestion) return { session, handled: true, accepted: false }

  // A direct approval or a concrete preference is enough direction. Avoid a
  // second confirmation round: preserve the user's wording for the next role.
  const accepted = ACCEPT_RE.test(text) || text.length >= 8
  if (!accepted) return { session, handled: true, accepted: false }
  session.contextNotes.push(
    `${state === 'awaiting_idea' ? 'Direction' : 'Plan approval'}: ${text}`,
  )
  const next = advanceOrchestration(
    state,
    state === 'awaiting_idea' ? 'idea_accepted' : 'plan_accepted',
    orchestration.repairRound,
    orchestration.maxRepairRounds,
  )
  orchestration.state = next.state
  orchestration.repairRound = next.repairRound
  session.phase = next.state === 'building' ? 'execute' : 'plan'
  session.updatedAt = Date.now()
  return { session, handled: true, accepted: true }
}

export function maybeAdvanceOrchestrationFromText(
  cwd: string,
  text: string,
  autoAcceptPlan: boolean,
): { advanced: boolean; continueWithNextRole: boolean } {
  const session = loadAgentSession(cwd)
  if (!session?.orchestration)
    return { advanced: false, continueWithNextRole: false }
  const result = applyOrchestrationOutput(session, text, autoAcceptPlan)
  if (!result.advanced) return { advanced: false, continueWithNextRole: false }
  saveAgentSession(result.session)
  const state = result.session.orchestration?.state
  return {
    advanced: true,
    continueWithNextRole: state === 'building' || state === 'verifying',
  }
}
