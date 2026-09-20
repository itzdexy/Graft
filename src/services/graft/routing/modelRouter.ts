/**
 * Cost- and latency-aware model routing (Phase 16).
 */

import { inferModelTier } from '../catalogModels.js'
import { isGraftAutoFailoverEnabled } from '../providerFailover.js'

export type TaskProfile = 'chat' | 'code' | 'research' | 'verify' | 'cheap'

export type ModelRoutingHint = {
  tier: 'haiku' | 'sonnet' | 'opus'
  reason: string
  preferLocal: boolean
}

export function profileForGoal(goal: string): TaskProfile {
  const g = goal.toLowerCase()
  if (/\b(cheap|budget|tokens?|cost)\b/.test(g)) return 'cheap'
  if (/\b(research|search|docs|web)\b/.test(g)) return 'research'
  if (/\b(test|lint|verify|fix|build|implement)\b/.test(g)) return 'code'
  return 'chat'
}

export function suggestModelTierForProfile(profile: TaskProfile): ModelRoutingHint {
  switch (profile) {
    case 'cheap':
      return {
        tier: 'haiku',
        reason: 'User asked to save cost — prefer smallest verified model.',
        preferLocal: true,
      }
    case 'research':
      return {
        tier: 'sonnet',
        reason: 'Research benefits from balanced context and tool use.',
        preferLocal: false,
      }
    case 'code':
    case 'verify':
      return {
        tier: 'sonnet',
        reason: 'Coding and verify loops need reliable tool calling.',
        preferLocal: false,
      }
    default:
      return {
        tier: 'sonnet',
        reason: 'Default balanced tier for interactive chat.',
        preferLocal: false,
      }
  }
}

export function suggestModelForTask(
  goal: string,
  availableModelIds: string[],
): string | null {
  const profile = profileForGoal(goal)
  const hint = suggestModelTierForProfile(profile)
  const tiered = availableModelIds.filter(id => inferModelTier(id) === hint.tier)
  if (tiered.length) return tiered[0]!
  const any = availableModelIds[0]
  return any ?? null
}

export function formatModelRoutingStatus(): string {
  const failover = isGraftAutoFailoverEnabled()
  return [
    '# Model routing (Phase 16)',
    '',
    `- Auto-failover: ${failover ? 'on (GRAFT_AUTO_FAILOVER=1)' : 'off — enable for provider recovery'}`,
    '- Cost-aware: mention "cheap" or "save tokens" in goals for haiku-tier picks',
    '- Local burst: /cookbook + Ollama/vLLM via custom OpenAI-compatible provider',
    '- Latency measurement: planned — use /model to switch manually today',
  ].join('\n')
}
