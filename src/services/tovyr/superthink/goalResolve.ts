import { goalSlug } from './researchStore.js'
import {
  getActiveSuperthinkGoal,
  hasApprovedPlan,
  hasResearchBrief,
  listSuperthinkSessions,
} from './sessionStore.js'

/** User phrases that mean "continue the current superthink goal", not a new one. */
const VAGUE_CONTINUATION =
  /^(it|this|that|the\s+project|the\s+site|the\s+app|code\s*it|build\s*it|do\s*it|go|start|proceed|implement(\s*it)?|ship\s*it|make\s*it|continue|next|yes|ok|okay)$/i

const STRIP_PREFIX =
  /^(please\s+)?(code|build|implement|create|make|ship|do|start|continue)\s+(it|this|that)\s*$/i

export function isVagueSuperthinkGoal(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (VAGUE_CONTINUATION.test(t)) return true
  if (STRIP_PREFIX.test(t)) return true
  return t.split(/\s+/).length <= 2 && /^(code|build|implement|go|continue)$/i.test(t)
}

/**
 * Resolve a goal string for superthink. Vague phrases ("code it", "go") attach to
 * the active or most recent in-progress session instead of spawning a new slug.
 */
export function resolveSuperthinkGoal(cwd: string, rawGoal: string): string {
  const trimmed = rawGoal.trim()
  if (trimmed && !isVagueSuperthinkGoal(trimmed)) return trimmed

  const active = getActiveSuperthinkGoal(cwd)
  if (active) return active

  const sessions = listSuperthinkSessions(cwd)
  if (sessions.length === 0) return trimmed

  const awaitingClarify = sessions.find(
    s => hasResearchBrief(cwd, s.goal) && !hasApprovedPlan(cwd, s.goal),
  )
  if (awaitingClarify) return awaitingClarify.goal

  return sessions[0]!.goal
}

/** Match user input to an existing session slug when goals were phrased differently. */
export function findSessionGoalBySlug(cwd: string, slug: string): string | null {
  const sessions = listSuperthinkSessions(cwd)
  const hit = sessions.find(s => s.slug === slug || goalSlug(s.goal) === slug)
  return hit?.goal ?? null
}
