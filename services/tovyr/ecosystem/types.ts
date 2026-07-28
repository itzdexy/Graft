/** Upstream open-source coding agent this adapter is inspired by. */
export type EcosystemUpstreamId =
  | 'codex'
  | 'claude-code'
  | 'cline'
  | 'agent-reach'
  | 'claw-code'
  | 'gemini-cli'
  | 'opencode'
  | 'aider'
  | 'goose'
  | 'openhands'
  | 'crush'
  | 'plandex'
  | 'continue'
  | 'gpt-engineer'
  | 'autogpt'
  | 'warp'
  | 'openinterpreter'

export type EcosystemFeature = {
  id: string
  label: string
  summary: string
  /** Tovyr command or skill that exposes this feature, if any. */
  tovyrHook?: string
  /** Path under services/tovyr that implements the port. */
  impl?: string
}

export type EcosystemUpstream = {
  id: EcosystemUpstreamId
  name: string
  repo: string
  license: string
  stars?: string
  summary: string
  features: EcosystemFeature[]
  /** Skill id under .tovyr/ecosystem/skills when present. */
  skill?: string
}
