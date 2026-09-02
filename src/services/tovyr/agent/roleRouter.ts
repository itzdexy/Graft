import type { ModelReadinessState } from '../modelReadiness.js'
import type { AgentRoleAssignment, OrchestrationRole } from './types.js'

export type OrchestrationModelCandidate = {
  modelId: string
  state: ModelReadinessState
  supportsTools: boolean
  reasoning?: boolean
  contextWindow?: number
  latencyMs?: number
}

export type RoleRoutingResult =
  | {
      ok: true
      assignments: Record<OrchestrationRole, AgentRoleAssignment>
      warnings: string[]
    }
  | {
      ok: false
      assignments: Partial<Record<OrchestrationRole, AgentRoleAssignment>>
      warnings: string[]
      message: string
    }

function familyAffinity(
  modelId: string,
  role: OrchestrationRole,
): number {
  const id = modelId.toLowerCase()
  if (role === 'planner' && id.includes('fable')) return 40
  if (role === 'builder' && id.includes('opus')) return 40
  if (role === 'verifier' && id.includes('opus')) return 40
  if (role === 'builder' && id.includes('fable')) return 30
  return 0
}

function byPlannerFitness(a: OrchestrationModelCandidate, b: OrchestrationModelCandidate): number {
  return (
    familyAffinity(b.modelId, 'planner') - familyAffinity(a.modelId, 'planner') ||
    Number(Boolean(b.reasoning)) - Number(Boolean(a.reasoning)) ||
    (b.contextWindow ?? 0) - (a.contextWindow ?? 0) ||
    (a.latencyMs ?? Number.MAX_SAFE_INTEGER) - (b.latencyMs ?? Number.MAX_SAFE_INTEGER)
  )
}

function byBuilderFitness(a: OrchestrationModelCandidate, b: OrchestrationModelCandidate): number {
  return (
    familyAffinity(b.modelId, 'builder') - familyAffinity(a.modelId, 'builder') ||
    (a.latencyMs ?? Number.MAX_SAFE_INTEGER) - (b.latencyMs ?? Number.MAX_SAFE_INTEGER) ||
    (b.contextWindow ?? 0) - (a.contextWindow ?? 0) ||
    Number(Boolean(b.reasoning)) - Number(Boolean(a.reasoning))
  )
}

function assignment(
  role: OrchestrationRole,
  providerId: string,
  model: OrchestrationModelCandidate,
): AgentRoleAssignment {
  return { role, providerId, modelId: model.modelId }
}

export function assignOrchestrationRoles(input: {
  providerId: string
  models: OrchestrationModelCandidate[]
}): RoleRoutingResult {
  const eligible = input.models.filter(model => model.state === 'ready' && model.supportsTools)
  if (eligible.length === 0) {
    return {
      ok: false,
      assignments: {},
      warnings: [],
      message: `No ready, tool-capable models are available from ${input.providerId}.`,
    }
  }

  const planner = [...eligible].sort(byPlannerFitness)[0]
  const builder = [...eligible].sort(byBuilderFitness)[0]
  const verifierCandidates = eligible.filter(
    model => model.modelId !== builder.modelId && model.modelId !== planner.modelId,
  )
  const independentFromBuilder = eligible.filter(model => model.modelId !== builder.modelId)
  const verifier = [...(verifierCandidates.length ? verifierCandidates : independentFromBuilder)].sort(
    byPlannerFitness,
  )[0] ?? builder

  const assignments: Record<OrchestrationRole, AgentRoleAssignment> = {
    planner: assignment('planner', input.providerId, planner),
    builder: assignment('builder', input.providerId, builder),
    verifier: assignment('verifier', input.providerId, verifier),
  }

  const distinctModels = new Set(Object.values(assignments).map(value => value.modelId))
  // Say what to do about it. The bare observation appeared on every build and
  // read as a scolding, because a user with one eligible model has no way to
  // act on "verification is not independent".
  const warnings =
    distinctModels.size === 1
      ? [
          `Only one model on ${input.providerId} is ready for agent work, so the planner, builder and verifier all use ${builder.modelId} — the verifier cannot catch its own mistakes. Connect a second provider with /provider for independent review.`,
        ]
      : []

  return { ok: true, assignments, warnings }
}
