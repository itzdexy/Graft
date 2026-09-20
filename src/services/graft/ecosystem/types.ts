/** Upstream open-source coding agent this adapter is inspired by. */
export type EcosystemUpstreamId =
  | 'codex'
  | 'claude-code'
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
  /** Graft command or skill that exposes this feature, if any. */
  graftHook?: string
  /** Path under services/graft that implements the port. */
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
  /**
   * Formerly a bundled `ecosystem-*` blurb skill. Those were removed — they
   * consumed skill-list context every turn and the model wrote one into a
   * user's repository as ecosystem.md. Kept optional so the field can carry a
   * real skill id if one is ever implemented.
   */
  skill?: string
}
