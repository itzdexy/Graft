/**
 * Typed model registry — shared vocabulary for model identity, capability,
 * context size, and pricing.
 *
 * Before this module, the same facts lived in four places:
 *   - scripts/tovyr-provider-catalog.js  (id/label/tier, loose `context` string)
 *   - utils/modelCost.ts                 (pricing, keyed by canonical name)
 *   - utils/model/modelOptions.ts        (hand-written picker labels per tier)
 *   - services/tovyr/modelContext.ts     (context windows via regex inference)
 *
 * The registry is the typed overlay those readers delegate to. It deliberately
 * keeps the provider's real upstream model id in a dedicated field so provider
 * adapters keep owning the wire value while Tovyr owns the alias.
 */

/** Reasoning effort levels a model may accept. */
export type RegistryEffortLevel = 'low' | 'medium' | 'high' | 'max'

/** Coarse capability tier, retained for compatibility with the JS catalog. */
export type ModelTier = 'opus' | 'sonnet' | 'haiku'

/** USD price per one million tokens. */
export type TokenPricing = {
  inputPerMTok: number
  outputPerMTok: number
  /** Price per Mtok for reading a cached prompt prefix. */
  cacheReadPerMTok?: number
  /** Price per Mtok for writing a prompt prefix into cache. */
  cacheWritePerMTok?: number
}

export type FastModeSupport = {
  /**
   * Whether fast mode may be enabled while this model is selected.
   * Obsolete models must set this to false rather than relying on the
   * caller to string-match the model id.
   */
  eligible: boolean
  /** Pricing applied when a request is billed at fast-mode rates. */
  pricing?: TokenPricing
}

export type ReasoningSupport = {
  supported: boolean
  /** Effort levels the provider accepts. Empty when `supported` is false. */
  efforts: RegistryEffortLevel[]
}

export type EntitlementRequirement = {
  /**
   * Opaque entitlement key checked against account state. Absent means the
   * model needs no entitlement beyond a working credential.
   */
  requires?: string
}

export type DeprecationInfo = {
  since: string
  /** Alias callers should migrate to. */
  replacedBy?: string
}

export type TovyrModelEntry = {
  /** Tovyr-owned alias, stable across providers (e.g. 'opus-5'). */
  alias: string
  /** Provider this entry describes. */
  providerId: string
  /** The provider's real model id. Never rewritten for branding. */
  upstreamModelId: string
  /** Human-facing name, e.g. 'Opus 5'. */
  displayName: string
  family: string
  version: string
  /** Total context window in tokens. Numeric — never a '1M' string. */
  contextWindow: number
  maxOutputTokens?: number
  tier: ModelTier
  reasoning: ReasoningSupport
  fastMode: FastModeSupport
  pricing: TokenPricing
  entitlement?: EntitlementRequirement
  deprecated?: DeprecationInfo
  /**
   * Release ordering hint. The highest value across the registry is the
   * "newest" model, which the picker highlights.
   */
  releaseRank: number
}

/** Result of resolving a caller-supplied model string. */
export type ModelResolution =
  | { status: 'resolved'; entry: TovyrModelEntry; viaAlias?: string }
  | { status: 'unavailable'; requested: string; reason: string }

/** Entitlement state as far as the client can currently tell. */
export type EntitlementState =
  | 'available'
  | 'unavailable'
  | 'unknown'
  | 'unverifiable'
