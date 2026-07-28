/**
 * Registry data for first-party Tovyr model entries.
 *
 * Adding a model means adding one row here. Pricing, context window, fast-mode
 * eligibility and reasoning support all travel together so no caller has to
 * string-match a model id to recover a fact about it.
 */

import type {
  TovyrModelEntry,
  FastModeSupport,
  ReasoningSupport,
  TokenPricing,
} from './registry.types.js'

const PRICE_OPUS_5: TokenPricing = {
  inputPerMTok: 5,
  outputPerMTok: 25,
  cacheReadPerMTok: 0.5,
  cacheWritePerMTok: 6.25,
}

/** Fast-mode rates for Opus 5: $10 in / $50 out per Mtok. */
const PRICE_OPUS_5_FAST: TokenPricing = {
  inputPerMTok: 10,
  outputPerMTok: 50,
  cacheReadPerMTok: 1,
  cacheWritePerMTok: 12.5,
}

const PRICE_OPUS_TIER: TokenPricing = {
  inputPerMTok: 5,
  outputPerMTok: 25,
  cacheReadPerMTok: 0.5,
  cacheWritePerMTok: 6.25,
}

const PRICE_OPUS_LEGACY: TokenPricing = {
  inputPerMTok: 15,
  outputPerMTok: 75,
  cacheReadPerMTok: 1.5,
  cacheWritePerMTok: 18.75,
}

const PRICE_SONNET_TIER: TokenPricing = {
  inputPerMTok: 3,
  outputPerMTok: 15,
  cacheReadPerMTok: 0.3,
  cacheWritePerMTok: 3.75,
}

const PRICE_HAIKU_45: TokenPricing = {
  inputPerMTok: 1,
  outputPerMTok: 5,
  cacheReadPerMTok: 0.1,
  cacheWritePerMTok: 1.25,
}

const PRICE_HAIKU_35: TokenPricing = {
  inputPerMTok: 0.8,
  outputPerMTok: 4,
  cacheReadPerMTok: 0.08,
  cacheWritePerMTok: 1,
}

/** Fresh object per row so no two entries share a mutable array. */
const NO_REASONING = (): ReasoningSupport => ({ supported: false, efforts: [] })

const FAST_INELIGIBLE: FastModeSupport = { eligible: false }

/**
 * Built-in registry rows.
 *
 * `releaseRank` orders newest-first for display; the maximum rank is the model
 * the picker highlights as newest.
 */
export const TOVYR_MODEL_REGISTRY: readonly TovyrModelEntry[] = [
  {
    alias: 'opus-5',
    providerId: 'anthropic',
    upstreamModelId: 'claude-opus-5',
    displayName: 'Opus 5',
    family: 'opus',
    version: '5',
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    tier: 'opus',
    reasoning: { supported: true, efforts: ['low', 'medium', 'high', 'max'] },
    fastMode: { eligible: true, pricing: PRICE_OPUS_5_FAST },
    pricing: PRICE_OPUS_5,
    releaseRank: 100,
  },
  {
    alias: 'opus-4-8',
    providerId: 'anthropic',
    upstreamModelId: 'claude-opus-4-8',
    displayName: 'Opus 4.8',
    family: 'opus',
    version: '4.8',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    tier: 'opus',
    reasoning: { supported: true, efforts: ['low', 'medium', 'high', 'max'] },
    fastMode: { eligible: true },
    pricing: PRICE_OPUS_TIER,
    releaseRank: 90,
  },
  {
    alias: 'opus-4-7',
    providerId: 'anthropic',
    upstreamModelId: 'claude-opus-4-7',
    displayName: 'Opus 4.7',
    family: 'opus',
    version: '4.7',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    tier: 'opus',
    reasoning: { supported: true, efforts: ['low', 'medium', 'high', 'max'] },
    fastMode: { eligible: true },
    pricing: PRICE_OPUS_TIER,
    releaseRank: 80,
  },
  {
    alias: 'opus-4-6',
    providerId: 'anthropic',
    upstreamModelId: 'claude-opus-4-6',
    displayName: 'Opus 4.6',
    family: 'opus',
    version: '4.6',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    tier: 'opus',
    reasoning: { supported: true, efforts: ['low', 'medium', 'high', 'max'] },
    fastMode: { eligible: true },
    pricing: PRICE_OPUS_TIER,
    releaseRank: 70,
  },
  {
    alias: 'opus-4-5',
    providerId: 'anthropic',
    upstreamModelId: 'claude-opus-4-5-20251101',
    displayName: 'Opus 4.5',
    family: 'opus',
    version: '4.5',
    contextWindow: 200_000,
    tier: 'opus',
    reasoning: NO_REASONING(),
    // Obsolete: fast mode removed rather than left to string matching.
    fastMode: FAST_INELIGIBLE,
    pricing: PRICE_OPUS_TIER,
    releaseRank: 60,
  },
  {
    alias: 'opus-4-1',
    providerId: 'anthropic',
    upstreamModelId: 'claude-opus-4-1-20250805',
    displayName: 'Opus 4.1',
    family: 'opus',
    version: '4.1',
    contextWindow: 200_000,
    tier: 'opus',
    reasoning: NO_REASONING(),
    fastMode: FAST_INELIGIBLE,
    pricing: PRICE_OPUS_LEGACY,
    deprecated: { since: '2025-11-01', replacedBy: 'opus-4-5' },
    releaseRank: 30,
  },
  {
    alias: 'sonnet-5',
    providerId: 'anthropic',
    upstreamModelId: 'claude-sonnet-5',
    displayName: 'Sonnet 5',
    family: 'sonnet',
    version: '5',
    contextWindow: 1_000_000,
    maxOutputTokens: 64_000,
    tier: 'sonnet',
    reasoning: { supported: true, efforts: ['low', 'medium', 'high'] },
    fastMode: FAST_INELIGIBLE,
    pricing: PRICE_SONNET_TIER,
    releaseRank: 95,
  },
  {
    alias: 'sonnet-4-6',
    providerId: 'anthropic',
    upstreamModelId: 'claude-sonnet',
    displayName: 'Sonnet 4.6',
    family: 'sonnet',
    version: '4.6',
    contextWindow: 200_000,
    maxOutputTokens: 64_000,
    tier: 'sonnet',
    reasoning: { supported: true, efforts: ['low', 'medium', 'high'] },
    fastMode: FAST_INELIGIBLE,
    pricing: PRICE_SONNET_TIER,
    releaseRank: 65,
  },
  {
    alias: 'sonnet-4-5',
    providerId: 'anthropic',
    upstreamModelId: 'claude-sonnet-20250929',
    displayName: 'Sonnet 4.5',
    family: 'sonnet',
    version: '4.5',
    contextWindow: 200_000,
    tier: 'sonnet',
    reasoning: NO_REASONING(),
    fastMode: FAST_INELIGIBLE,
    pricing: PRICE_SONNET_TIER,
    releaseRank: 50,
  },
  {
    alias: 'sonnet-4',
    providerId: 'anthropic',
    upstreamModelId: 'claude-sonnet-4-20250514',
    displayName: 'Sonnet 4',
    family: 'sonnet',
    version: '4',
    contextWindow: 200_000,
    tier: 'sonnet',
    reasoning: NO_REASONING(),
    fastMode: FAST_INELIGIBLE,
    pricing: PRICE_SONNET_TIER,
    deprecated: { since: '2025-09-29', replacedBy: 'sonnet-4-5' },
    releaseRank: 25,
  },
  {
    alias: 'haiku-4-5',
    providerId: 'anthropic',
    upstreamModelId: 'claude-haiku-4-5-20251001',
    displayName: 'Haiku 4.5',
    family: 'haiku',
    version: '4.5',
    contextWindow: 200_000,
    tier: 'haiku',
    reasoning: NO_REASONING(),
    fastMode: FAST_INELIGIBLE,
    pricing: PRICE_HAIKU_45,
    releaseRank: 40,
  },
  {
    alias: 'haiku-3-5',
    providerId: 'anthropic',
    upstreamModelId: 'claude-3-5-haiku-20241022',
    displayName: 'Haiku 3.5',
    family: 'haiku',
    version: '3.5',
    contextWindow: 200_000,
    tier: 'haiku',
    reasoning: NO_REASONING(),
    fastMode: FAST_INELIGIBLE,
    pricing: PRICE_HAIKU_35,
    deprecated: { since: '2025-10-01', replacedBy: 'haiku-4-5' },
    releaseRank: 10,
  },
]

/**
 * Legacy alias → current alias.
 *
 * Kept separate from the registry rows so a migration can be removed later
 * without disturbing model data. Resolution follows this map transitively.
 */
export const LEGACY_ALIAS_MIGRATIONS: Readonly<Record<string, string>> = {
  opus: 'opus-4-8',
  sonnet: 'sonnet-4-6',
  haiku: 'haiku-4-5',
  'opus-4': 'opus-4-1',
  'claude-opus-4-8': 'opus-4-8',
  'claude-opus-4-7': 'opus-4-7',
  'claude-opus-4-6': 'opus-4-6',
  'claude-sonnet-5': 'sonnet-5',
  'claude-opus-5': 'opus-5',
}
