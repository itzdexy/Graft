/** Autonomous agent loop phases (Observe → … → Continue). */
export type AgentPhase =
  | 'observe'
  | 'think'
  | 'plan'
  | 'execute'
  | 'verify'
  | 'reflect'
  | 'continue'
  | 'done'
  | 'failed'
  | 'paused'

export type AgentStepStatus = 'pending' | 'in_progress' | 'done' | 'failed' | 'skipped'

export type AgentStep = {
  id: string
  title: string
  description: string
  status: AgentStepStatus
  specialist?: SpecialistRole
  attempts: number
  lastError?: string
  completedAt?: number
}

export type AgentGoal = {
  id: string
  text: string
  acceptanceCriteria: string[]
  createdAt: number
  completedAt?: number
}

export type AgentSession = {
  id: string
  cwd: string
  goal: AgentGoal
  phase: AgentPhase
  steps: AgentStep[]
  currentStepIndex: number
  reflections: string[]
  contextNotes: string[]
  startedAt: number
  updatedAt: number
  maxRetriesPerStep: number
  /** Run verify/fix loop without stopping on first failure */
  autoFix?: boolean
  maxAutoFixRounds?: number
  autoFixRound?: number
  /** Loop guard counters — persisted so limits survive restarts */
  loop?: AgentLoopState
  /** Optional caps (defaults from AGENT_DEFAULT_*) */
  maxTurns?: number
  maxToolCalls?: number
  sessionTimeoutMs?: number
  orchestration?: AgentOrchestration
}

export type OrchestrationRole = 'planner' | 'builder' | 'verifier'

export type OrchestrationState =
  | 'ideating'
  | 'awaiting_idea'
  | 'drafting_plan'
  | 'awaiting_plan'
  | 'building'
  | 'verifying'
  | 'needs_input'
  | 'needs_changes'
  | 'model_failed'
  | 'blocked'
  | 'complete'

export type AgentRoleAssignment = {
  role: OrchestrationRole
  providerId: string
  modelId: string
  readinessCheckedAt?: number
}

export type AgentStepEvidence = {
  stepId: string
  role: OrchestrationRole
  modelId: string
  summary: string
  filesChanged: string[]
  commands: string[]
  failures: string[]
  createdAt: number
}

export type AgentOrchestration = {
  schemaVersion: 2
  enabled: true
  state: OrchestrationState
  assignments: Record<OrchestrationRole, AgentRoleAssignment>
  evidence: AgentStepEvidence[]
  repairRound: number
  maxRepairRounds: number
  warnings: string[]
  /** New natural-language builds pause at both direction and plan review. */
  approvalPolicy?: 'ideas-and-plan' | 'automatic'
}

export type SpecialistRole =
  | 'planner'
  | 'coder'
  | 'reviewer'
  | 'debugger'
  | 'research'
  | 'browser'
  | 'devops'
  | 'memory'
  | 'benchmark'
  | 'coordinator'

export const AGENT_PHASE_ORDER: AgentPhase[] = [
  'observe',
  'think',
  'plan',
  'execute',
  'verify',
  'reflect',
  'continue',
]

export const DEFAULT_MAX_RETRIES = 3

/** Per-session loop limits (env overrides supported). */
export const AGENT_DEFAULT_MAX_TURNS = 50
export const AGENT_DEFAULT_MAX_TOOL_CALLS = 150
export const AGENT_DEFAULT_SESSION_TIMEOUT_MS = 30 * 60 * 1000
export const AGENT_DEFAULT_MAX_REPEATED_FAILURES = 3
export const AGENT_DEFAULT_MAX_EMPTY_OUTPUTS = 2

export type AgentLoopStopReason =
  | 'max_turns'
  | 'max_tool_calls'
  | 'session_timeout'
  | 'repeated_failure'
  | 'empty_output'
  | 'user_stop'

export type AgentLoopState = {
  turnCount: number
  toolCallCount: number
  startedAt: number
  lastFailedToolSignature?: string
  repeatedFailureCount: number
  emptyOutputCount: number
  stopReason?: AgentLoopStopReason
  stopMessage?: string
}
