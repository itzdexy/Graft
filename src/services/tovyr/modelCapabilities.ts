import { inferModelTier } from './catalogModels.js'
import { inferContextWindowFromModelId, lookupCatalogModelContext } from './modelContext.js'
import {
  getActiveProviderId,
  getProvider,
} from '../../../scripts/tovyr-providers.js'

export type CostCategory = 'budget' | 'standard' | 'premium'

export type ModelCapabilities = {
  toolCalling: boolean
  streaming: boolean
  jsonMode: boolean
  vision: boolean
  reasoning: boolean
  contextTokens: number | null
  costCategory: CostCategory
  source: 'catalog' | 'override' | 'inferred'
}

type CapabilityPartial = Partial<ModelCapabilities>

/** Curated capability overrides for well-known model ids. */
const CAPABILITY_OVERRIDES: Record<string, CapabilityPartial> = {
  'nvidia/nemotron-3-nano-30b-a3b': {
    toolCalling: true,
    streaming: true,
    jsonMode: true,
    vision: false,
    reasoning: true,
    contextTokens: 262_144,
    costCategory: 'standard',
  },
  'claude-opus-4-1-20250805': {
    toolCalling: true,
    streaming: true,
    jsonMode: true,
    vision: true,
    reasoning: true,
    contextTokens: 200_000,
    costCategory: 'premium',
  },
  'claude-sonnet-20250929': {
    toolCalling: true,
    streaming: true,
    jsonMode: true,
    vision: true,
    reasoning: true,
    contextTokens: 200_000,
    costCategory: 'standard',
  },
  'claude-3-5-haiku-20241022': {
    toolCalling: true,
    streaming: true,
    jsonMode: true,
    vision: true,
    reasoning: false,
    contextTokens: 200_000,
    costCategory: 'budget',
  },
  'openai/gpt-4o': {
    toolCalling: true,
    streaming: true,
    jsonMode: true,
    vision: true,
    reasoning: false,
    contextTokens: 128_000,
    costCategory: 'standard',
  },
  'openai/o3-mini': {
    toolCalling: true,
    streaming: true,
    jsonMode: true,
    vision: false,
    reasoning: true,
    contextTokens: 200_000,
    costCategory: 'premium',
  },
  'google/gemini-2.5-pro-preview': {
    toolCalling: true,
    streaming: true,
    jsonMode: true,
    vision: true,
    reasoning: true,
    contextTokens: 1_000_000,
    costCategory: 'premium',
  },
  'google/gemini-2.5-flash-preview': {
    toolCalling: true,
    streaming: true,
    jsonMode: true,
    vision: true,
    reasoning: false,
    contextTokens: 1_000_000,
    costCategory: 'budget',
  },
  'anthropic/claude-sonnet': {
    toolCalling: true,
    streaming: true,
    jsonMode: true,
    vision: true,
    reasoning: true,
    contextTokens: 200_000,
    costCategory: 'standard',
  },
}

export function tierToCostCategory(
  tier: 'opus' | 'sonnet' | 'haiku',
): CostCategory {
  switch (tier) {
    case 'opus':
      return 'premium'
    case 'haiku':
      return 'budget'
    default:
      return 'standard'
  }
}

function inferFromModelId(modelId: string): CapabilityPartial {
  const id = modelId.toLowerCase()
  const vision =
    /\b(vision|vl|4o|4\.1|gemini|pixtral|llava|qwen-?vl|gemma-2-27b|gpt-4|claude-(3|sonnet|opus)|glm-4v|mistral-large|llama-4|multimodal)\b/.test(
      id,
    )
  const reasoning =
    /\b(o1|o3|r1|reason|think|deepseek-r1|qwq|opus|glm)\b/.test(id) &&
    !/\bmini\b/.test(id)
  const toolCalling = !/\b(embed|embedding|whisper|tts|dall-e|imagen|codellama|code.?llama|guard|rerank)\b/.test(
    id,
  )
  const tier = inferModelTier(modelId)

  return {
    toolCalling,
    streaming: true,
    jsonMode: toolCalling,
    vision,
    reasoning,
    contextTokens: inferContextWindowFromModelId(modelId),
    costCategory: tierToCostCategory(tier),
  }
}

/** Resolve capability metadata for a model on a provider. */
export function resolveModelCapabilities(
  modelId: string,
  providerId?: string,
): ModelCapabilities {
  const pid = providerId ?? getActiveProviderId()
  const provider = getProvider(pid)
  const catalogEntry = provider?.models?.find(m => m.id === modelId)

  const override = CAPABILITY_OVERRIDES[modelId]
  if (override) {
    const inferred = inferFromModelId(modelId)
    return {
      toolCalling: override.toolCalling ?? inferred.toolCalling ?? true,
      streaming: override.streaming ?? true,
      jsonMode: override.jsonMode ?? inferred.jsonMode ?? true,
      vision: override.vision ?? inferred.vision ?? false,
      reasoning: override.reasoning ?? inferred.reasoning ?? false,
      contextTokens:
        override.contextTokens ??
        lookupCatalogModelContext(modelId, pid) ??
        inferred.contextTokens ??
        null,
      costCategory:
        override.costCategory ??
        tierToCostCategory(catalogEntry?.tier ?? inferModelTier(modelId)),
      source: 'override',
    }
  }

  if (catalogEntry) {
    const inferred = inferFromModelId(modelId)
    const contextFromCatalog = catalogEntry.context
      ? lookupCatalogModelContext(modelId, pid)
      : null
    return {
      toolCalling: inferred.toolCalling ?? true,
      streaming: true,
      jsonMode: inferred.jsonMode ?? true,
      vision: inferred.vision ?? false,
      reasoning: inferred.reasoning ?? false,
      contextTokens: contextFromCatalog ?? inferred.contextTokens ?? null,
      costCategory: tierToCostCategory(catalogEntry.tier),
      source: 'catalog',
    }
  }

  const inferred = inferFromModelId(modelId)
  return {
    toolCalling: inferred.toolCalling ?? true,
    streaming: true,
    jsonMode: inferred.jsonMode ?? true,
    vision: inferred.vision ?? false,
    reasoning: inferred.reasoning ?? false,
    contextTokens:
      lookupCatalogModelContext(modelId, pid) ??
      inferred.contextTokens ??
      null,
    costCategory: inferred.costCategory ?? 'standard',
    source: 'inferred',
  }
}

export function formatCapabilitiesSummary(caps: ModelCapabilities): string {
  const flags: string[] = []
  if (caps.toolCalling) flags.push('tools')
  if (caps.streaming) flags.push('stream')
  if (caps.jsonMode) flags.push('json')
  if (caps.vision) flags.push('vision')
  if (caps.reasoning) flags.push('reasoning')
  const ctx =
    caps.contextTokens != null
      ? `${Math.round(caps.contextTokens / 1000)}k ctx`
      : 'ctx unknown'
  return `${flags.join(', ') || 'basic'} · ${ctx} · ${caps.costCategory}`
}

/** Compact badges for `/model` picker rows: Vision / Tools / Slow. */
export function formatPickerCapabilityBadges(modelId: string): string {
  // Called `getModelCapabilities`, which does not exist — this threw
  // ReferenceError for every real user, because its only caller
  // (decorateModelOptionsWithCapabilityBadges in utils/model/modelOptions.ts)
  // runs behind an isTovyrRuntime() check that is always true in the product.
  const caps = resolveModelCapabilities(modelId)
  const parts: string[] = []
  if (caps.vision) parts.push('Vision')
  if (caps.toolCalling) parts.push('Tools')
  if (caps.reasoning || caps.costCategory === 'premium') parts.push('Slow')
  return parts.join(' · ')
}
