import type { AgentSession, OrchestrationRole } from './types.js'

function roleForState(state: NonNullable<AgentSession['orchestration']>['state']): OrchestrationRole | null {
  if (
    state === 'ideating' ||
    state === 'awaiting_idea' ||
    state === 'drafting_plan' ||
    state === 'awaiting_plan'
  ) return 'planner'
  if (state === 'building' || state === 'needs_changes') return 'builder'
  if (state === 'verifying') return 'verifier'
  return null
}

export function getActiveRoleModel(session: AgentSession | null, activeProviderId: string):
  | { ok: true; role: OrchestrationRole; modelId: string }
  | { ok: false; message: string } {
  const orchestration = session?.orchestration
  if (!orchestration?.enabled) return { ok: false, message: 'Adaptive orchestration is not active.' }
  const role = roleForState(orchestration.state)
  if (!role) return { ok: false, message: `No model role is active while orchestration is ${orchestration.state}.` }
  const selected = orchestration.assignments[role]
  if (selected.providerId !== activeProviderId) {
    return { ok: false, message: `The ${role} assignment belongs to ${selected.providerId}, not the active provider ${activeProviderId}.` }
  }
  return { ok: true, role, modelId: selected.modelId }
}
