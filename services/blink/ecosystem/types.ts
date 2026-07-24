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
  /** Blink command or skill that exposes this feature, if any. */
  blinkHook?: string
  /** Path under services/blink that implements the port. */
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
  /** Skill id under .blink/ecosystem/skills when present. */
  skill?: string
}
