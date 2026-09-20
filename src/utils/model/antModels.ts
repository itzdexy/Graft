import type { EffortLevel } from '../effort.js'

/** Legacy model types retained for source compatibility. */
export type AntModel = {
  alias: string
  model: string
  label: string
  description?: string
  defaultEffortValue?: number
  defaultEffortLevel?: EffortLevel
  contextWindow?: number
  defaultMaxTokens?: number
  upperMaxTokensLimit?: number
  alwaysOnThinking?: boolean
}

export type AntModelSwitchCalloutConfig = {
  modelAlias?: string
  description: string
  version: string
}

export type AntModelOverrideConfig = {
  defaultModel?: string
  defaultModelEffortLevel?: EffortLevel
  defaultSystemPromptSuffix?: string
  antModels?: AntModel[]
  switchCallout?: AntModelSwitchCalloutConfig
}

// Public builds do not load organization-specific model overrides.
// Keep these exports so existing imports continue to resolve.
export function getAntModelOverrideConfig(): AntModelOverrideConfig | null {
  return null
}

export function getAntModels(): AntModel[] {
  return []
}

export function resolveAntModel(
  _model: string | undefined,
): AntModel | undefined {
  return undefined
}
