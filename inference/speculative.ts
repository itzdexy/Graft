/**
 * Speculative decoding configuration (llama.cpp / vLLM pattern).
 * Draft model proposes tokens; target model verifies in parallel.
 */

export interface SpeculativeDecodingConfig {
  enabled: boolean
  draftModel?: string
  draftTokens: number
  minDraftAcceptance: number
}

const DEFAULT_CONFIG: SpeculativeDecodingConfig = {
  enabled: false,
  draftTokens: 5,
  minDraftAcceptance: 0.6,
}

let activeConfig: SpeculativeDecodingConfig = { ...DEFAULT_CONFIG }

export function getSpeculativeDecodingConfig(): SpeculativeDecodingConfig {
  return { ...activeConfig }
}

export function setSpeculativeDecodingConfig(
  patch: Partial<SpeculativeDecodingConfig>,
): SpeculativeDecodingConfig {
  activeConfig = { ...activeConfig, ...patch }
  return getSpeculativeDecodingConfig()
}

export function speculativeDecodingFromEnv(): SpeculativeDecodingConfig {
  const enabled =
    process.env.BLINK_SPECULATIVE_DECODING === '1' ||
    process.env.LLAMA_SPECULATIVE === '1'
  const draftModel =
    process.env.BLINK_DRAFT_MODEL ?? process.env.LLAMA_DRAFT_MODEL
  const draftTokens = Number(process.env.BLINK_DRAFT_TOKENS ?? 5)
  return setSpeculativeDecodingConfig({
    enabled,
    draftModel,
    draftTokens: Number.isFinite(draftTokens) ? draftTokens : 5,
  })
}

/** Map config to llama.cpp / OpenAI-compatible request extras. */
export function toInferenceExtras(
  config: SpeculativeDecodingConfig = activeConfig,
): Record<string, unknown> {
  if (!config.enabled) return {}
  return {
    speculative: true,
    draft_model: config.draftModel,
    n_draft: config.draftTokens,
    min_p_accept: config.minDraftAcceptance,
  }
}
