import { getActiveModelId, getActiveProviderId } from '../../../../scripts/tovyr-providers.js'
import { resolveModelCapabilities } from '../modelCapabilities.js'
import { listModelReadiness } from '../modelReadiness.js'
import { shouldUseAdaptiveOrchestration } from './orchestrationState.js'
import { assignOrchestrationRoles } from './roleRouter.js'
import type { AgentOrchestration } from './types.js'

export function createAdaptiveOrchestration(
  prompt: string,
  providerId = getActiveProviderId(),
): AgentOrchestration | null {
  if (!shouldUseAdaptiveOrchestration(prompt)) return null
  const records = listModelReadiness(providerId)
  const routed = assignOrchestrationRoles({
    providerId,
    models: records.map(record => {
      const capabilities = resolveModelCapabilities(record.modelId, providerId)
      return {
        modelId: record.modelId,
        state: record.state,
        supportsTools: record.supportsTools ?? capabilities.toolCalling,
        reasoning: capabilities.reasoning,
        contextWindow: capabilities.contextTokens ?? undefined,
        latencyMs: record.latencyMs,
      }
    }),
  })
  const fallbackModel = getActiveModelId(providerId)
  if (!routed.ok && !fallbackModel) return null

  const checkedAt = new Map(records.map(record => [record.modelId, record.checkedAt]))
  return {
    schemaVersion: 2,
    enabled: true,
    state: 'ideating',
    assignments: routed.ok
      ? {
          planner: {
            ...routed.assignments.planner,
            readinessCheckedAt: checkedAt.get(
              routed.assignments.planner.modelId,
            ),
          },
          builder: {
            ...routed.assignments.builder,
            readinessCheckedAt: checkedAt.get(
              routed.assignments.builder.modelId,
            ),
          },
          verifier: {
            ...routed.assignments.verifier,
            readinessCheckedAt: checkedAt.get(
              routed.assignments.verifier.modelId,
            ),
          },
        }
      : {
          planner: { role: 'planner', providerId, modelId: fallbackModel },
          builder: { role: 'builder', providerId, modelId: fallbackModel },
          verifier: { role: 'verifier', providerId, modelId: fallbackModel },
        },
    evidence: [],
    repairRound: 0,
    maxRepairRounds: 2,
    warnings: routed.ok
      ? routed.warnings
      : [
          'No additional verified models are warm yet; the active model will carry each role.',
        ],
    approvalPolicy: 'ideas-and-plan',
  }
}
