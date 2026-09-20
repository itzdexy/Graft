import type { OrchestrationState } from './types.js'

export type OrchestrationEvent =
  | 'ideas_ready'
  | 'idea_accepted'
  | 'plan_ready'
  | 'plan_accepted'
  | 'build_complete'
  | 'approved'
  | 'needs_changes'
  | 'needs_input'
  | 'model_failed'

export function advanceOrchestration(
  state: OrchestrationState,
  event: OrchestrationEvent,
  repairRound: number,
  maxRepairRounds: number,
): { state: OrchestrationState; repairRound: number } {
  if (event === 'needs_input') return { state: 'needs_input', repairRound }
  if (event === 'model_failed') return { state: 'model_failed', repairRound }
  if (state === 'ideating' && event === 'ideas_ready') return { state: 'awaiting_idea', repairRound }
  if (state === 'awaiting_idea' && event === 'idea_accepted') return { state: 'drafting_plan', repairRound }
  if (state === 'drafting_plan' && event === 'plan_ready') return { state: 'awaiting_plan', repairRound }
  if (state === 'awaiting_plan' && event === 'plan_accepted') return { state: 'building', repairRound }
  if (state === 'building' && event === 'build_complete') return { state: 'verifying', repairRound }
  if (state === 'verifying' && event === 'approved') return { state: 'complete', repairRound }
  if (state === 'verifying' && event === 'needs_changes') {
    const nextRound = repairRound + 1
    return {
      state: nextRound >= Math.max(1, maxRepairRounds) ? 'blocked' : 'building',
      repairRound: nextRound,
    }
  }
  return { state, repairRound }
}

const CASUAL_RE = /^(hi|hello|hey|yo|thanks|ok|okay|cool|help)[!.?]*$/i
const SMALL_EDIT_RE = /\b(rename|change|replace|fix typo|one[- ]line|single file)\b/i
const COMPLEXITY_RE = /\b(build|code|make|design|scaffold|implement|create|redesign|refactor|migrate|architecture|multi[- ]file|full|end[- ]to[- ]end)\b/i
const MULTI_CONCERN_RE = /\b(tests?|verify|documentation|docs|api|database|authentication|frontend|backend|ui|migration)\b/gi
const AMBIGUOUS_PRODUCT_RE = /\b(website|web\s*app|application|dashboard|landing\s+page|saas|cli|game|calculator|bot|agent)\b/i

export function shouldUseAdaptiveOrchestration(prompt: string): boolean {
  if (process.env.GRAFT_MULTI_MODEL === '0') return false
  const text = prompt.trim()
  if (!text || text.startsWith('/') || CASUAL_RE.test(text)) return false
  if (SMALL_EDIT_RE.test(text) && !/\b(multi[- ]file|all files|whole|entire)\b/i.test(text)) return false
  const concerns = new Set((text.match(MULTI_CONCERN_RE) ?? []).map(value => value.toLowerCase()))
  return (
    COMPLEXITY_RE.test(text) &&
    (concerns.size >= 2 || text.length >= 100 || AMBIGUOUS_PRODUCT_RE.test(text))
  )
}
