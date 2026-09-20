import { getProvider } from '../../../scripts/graft-providers.js'
import type { ModelDescriptor } from './providers/types.js'

export const META_PROVIDER_ID = 'meta'
export const META_MESSAGES_BASE_URL = 'https://api.meta.ai'
export const META_SPARK_MODEL_IDS = [
  'muse-spark-1.3',
  'muse-spark-1.3-contributor',
  'muse-spark-1.2',
  'muse-spark-1.2-contributor',
  'muse-spark-1.1',
] as const

const META_MEDIA_RE =
  /muse-image|muse-voice|voice-transcribe|\btts\b|\btranscri/i

export function isMetaProviderId(
  providerId: string | null | undefined,
): boolean {
  return providerId === META_PROVIDER_ID
}

export function isMetaMessagesBaseUrl(
  baseUrl: string | null | undefined,
): boolean {
  if (!baseUrl) return false
  try {
    return new URL(baseUrl).hostname === 'api.meta.ai'
  } catch {
    return /api\.meta\.ai/i.test(baseUrl)
  }
}

/** Anthropic SDK appends `/v1/messages`; Meta’s host must not already include `/v1`. */
export function normalizeMetaMessagesBaseUrl(baseUrl: string): string {
  const trimmed = (baseUrl || '').replace(/\/+$/, '')
  if (!isMetaMessagesBaseUrl(trimmed)) {
    return trimmed || META_MESSAGES_BASE_URL
  }
  return trimmed.replace(/\/v1$/i, '') || META_MESSAGES_BASE_URL
}

export function isMuseSparkModelId(modelId: string): boolean {
  return /^muse-spark-/i.test(modelId.trim())
}

export function isMetaMediaModelId(modelId: string): boolean {
  return META_MEDIA_RE.test(modelId.trim())
}

/** Coding-agent Muse Spark ids only — never image, voice, or transcribe. */
export function isMetaAgentModelId(modelId: string): boolean {
  return isMuseSparkModelId(modelId) && !isMetaMediaModelId(modelId)
}

export function isMetaModelApiActive(): boolean {
  return (
    process.env.GRAFT_ACTIVE_PROVIDER === META_PROVIDER_ID ||
    isMetaMessagesBaseUrl(process.env.ANTHROPIC_BASE_URL)
  )
}

/** Muse Spark always reasons; disabled thinking is HTTP 400 on Meta. */
export function isMuseSparkAlwaysReasoning(modelId: string): boolean {
  return isMetaAgentModelId(modelId) || isMetaModelApiActive()
}

export function filterMetaPickerModelIds(ids: readonly string[]): string[] {
  return ids.filter(isMetaAgentModelId)
}

export type MetaThinkingWire =
  | { type: 'adaptive' }
  | { type: 'enabled'; budget_tokens: number }
  | { type: 'disabled' }

/**
 * Meta Messages rejects `thinking: { type: "disabled" }` and ignores enabled
 * budgets below 1024. Adaptive is the supported default.
 */
export function remapMetaThinkingConfig(
  thinking: MetaThinkingWire | null | undefined,
): { type: 'adaptive' } | { type: 'enabled'; budget_tokens: number } {
  if (!thinking || thinking.type === 'disabled') {
    return { type: 'adaptive' }
  }
  if (thinking.type === 'enabled') {
    if (thinking.budget_tokens < 1024) return { type: 'adaptive' }
    return { type: 'enabled', budget_tokens: thinking.budget_tokens }
  }
  return { type: 'adaptive' }
}

/** Wire values Meta accepts on `output_config.effort`. Never `none` or `max`. */
export type MetaEffortWire = 'low' | 'medium' | 'high' | 'xhigh'

/**
 * Map Graft’s user-facing effort (low/medium/high/max) onto Meta’s
 * `output_config.effort`. Muse Spark always reasons; `none` is invalid.
 */
export function toMetaOutputEffort(
  value: string | number | null | undefined,
): MetaEffortWire {
  if (typeof value === 'number') {
    if (value <= 50) return 'low'
    if (value <= 85) return 'medium'
    if (value <= 100) return 'high'
    return 'xhigh'
  }
  const level = String(value ?? '').trim().toLowerCase()
  if (level === 'low' || level === 'medium' || level === 'high') return level
  if (level === 'max' || level === 'xhigh' || level === 'ultra') return 'xhigh'
  return 'high'
}

export function shouldSkipMetaChatProbe(
  providerId: string,
  modelId: string,
): boolean {
  return isMetaProviderId(providerId) && isMetaAgentModelId(modelId)
}

/**
 * Muse Spark spends short probe budgets on hidden reasoning, so a 2xx with
 * empty visible text is still a live coding model.
 */
export function metaProbeTreatsEmptyOutputAsSuccess(
  providerId: string,
  modelId: string,
): boolean {
  return isMetaProviderId(providerId) && isMetaAgentModelId(modelId)
}

export function metaCatalogDescriptors(): ModelDescriptor[] {
  const provider = getProvider(META_PROVIDER_ID)
  return (provider?.models ?? [])
    .filter(model => isMetaAgentModelId(model.id))
    .map(model => ({
      id: model.id,
      displayName: model.label,
      available: true,
      contextTokens: model.context === '1M' ? 1_000_000 : null,
      maxOutputTokens: 32_000,
      supportsTools: true,
      supportsVision: false,
      supportsReasoning: true,
      supportsStreaming: true,
      lifecycle: 'active' as const,
      source: 'catalog' as const,
    }))
}
