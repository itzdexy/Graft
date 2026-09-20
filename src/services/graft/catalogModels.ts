import { sortModelsBestToWorst } from '../../../scripts/graft-provider-catalog.js'
import { formatProviderModelDisplayName } from '../../../scripts/graft-model-display.js'
import { getProviderModelUnavailableReason } from './modelAvailability.js'
import {
  isMetaAgentModelId,
  isMetaProviderId,
} from './metaProvider.js'
import { isAgentSuitableOpenAiModel } from './openAiModelSuitability.js'

export type CatalogModel = {
  id: string
  label: string
  tier: 'opus' | 'sonnet' | 'haiku'
  context?: string
}

/** Display label for a model id returned by GET /v1/models but missing from the static catalog. */
export function humanizeOpenAiModelId(modelId: string): string {
  const slug = modelId.includes('/') ? modelId.split('/').pop()! : modelId
  const label = slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bIt\b/g, 'IT')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bNv\b/g, 'NV')
  return formatProviderModelDisplayName({ modelId, label })
}

export function inferModelTier(modelId: string): 'opus' | 'sonnet' | 'haiku' {
  const s = modelId.toLowerCase()
  if (
    /\b(1b|2b|3b|4b|7b|8b|mini|small|nano|guard|embed)\b/.test(s) &&
    !/\b(70b|72b|90b|405b|340b)\b/.test(s)
  ) {
    return 'haiku'
  }
  if (
    /\b(70b|72b|90b|405b|340b|480b|235b|large|r1|nemotron-4|deepseek-v3|deepseek-v4|deepseek-r1|glm-5|kimi-k3|grok-4\.5|qwen3|muse-spark|llama-4-maverick)\b/.test(
      s,
    )
  ) {
    return 'opus'
  }
  return 'sonnet'
}

type PickerProvider = {
  id?: string
  models?: CatalogModel[]
  apiFormat?: string
  baseUrl?: string
  /** When true, provider accepts arbitrary ids. */
  anyModel?: boolean
} | null

export type ResolvePickerOptions = {
  providerId: string
  /**
   * Kept for callers that still pass it; no longer changes the result. Live
   * ids are now used for every provider, not only the active one.
   */
  isActiveProvider?: boolean
}

/**
 * The models a provider actually serves, ready for the picker.
 *
 * Live ids are the list. The static catalog only contributes nicer labels and
 * tier ordering for ids it happens to know about.
 *
 * It used to work the other way round: the curated catalog was the list, and
 * live ids were intersected into it. That hid every model the hand-written
 * file had not been updated for — OpenRouter showed 34 of its several hundred
 * models, and a real model like `stealth/ox-alpha` simply could not be found.
 * A hand-maintained file cannot track what providers ship weekly, so it is no
 * longer allowed to decide what exists.
 *
 * Models that cannot run agent work (embeddings, moderation, TTS) are kept and
 * sorted last rather than dropped: they are findable if you search for them,
 * and `buildModelPickerRows` marks them unselectable.
 */
export function resolveProviderModelsForPicker(
  provider: PickerProvider,
  liveIds: Set<string> | string[] | null,
  options: ResolvePickerOptions,
): CatalogModel[] {
  const labelModel = (model: CatalogModel): CatalogModel => ({
    ...model,
    label: formatProviderModelDisplayName({
      providerId: options.providerId,
      modelId: model.id,
      label: model.label,
    }),
  })

  // Meta's /v1/models lists image and speech models that cannot run the agent.
  // The curated Muse Spark list (catalog order) is the picker source of truth.
  if (isMetaProviderId(options.providerId) || provider?.id === 'meta') {
    return (provider?.models ?? [])
      .filter(model => isMetaAgentModelId(model.id))
      .map(labelModel)
  }

  const catalog: CatalogModel[] = (
    sortModelsBestToWorst(provider?.models ?? []) as CatalogModel[]
  ).map(labelModel)

  const live = liveIds instanceof Set ? liveIds : new Set(liveIds ?? [])
  // No live list yet (offline, unfetched, or a provider with no /models
  // endpoint) — the catalog is the only thing we have.
  if (live.size === 0) return catalog

  const catalogById = new Map(catalog.map((m: CatalogModel) => [m.id, m]))
  const catalogRank = new Map<string, number>(
    catalog.map((m: CatalogModel, index: number) => [m.id, index] as const),
  )

  const suitable: CatalogModel[] = []
  const unsuitable: CatalogModel[] = []

  for (const id of live) {
    if (getProviderModelUnavailableReason(options.providerId, id)) continue
    const known = catalogById.get(id)
    const entry: CatalogModel = known ?? {
      id,
      label: humanizeOpenAiModelId(id),
      tier: inferModelTier(id),
    }
    if (isAgentSuitableOpenAiModel(id)) suitable.push(entry)
    else unsuitable.push(entry)
  }

  // Curated models keep their hand-picked order; everything else sorts by
  // tier. That preserves "best first" without capping the list.
  const rank = (model: CatalogModel): number =>
    catalogRank.get(model.id) ?? Number.MAX_SAFE_INTEGER

  const ordered: CatalogModel[] = [
    ...suitable
      .filter(m => catalogRank.has(m.id))
      .sort((a, b) => rank(a) - rank(b)),
    ...(sortModelsBestToWorst(
      suitable.filter(m => !catalogRank.has(m.id)),
    ) as CatalogModel[]),
    ...(sortModelsBestToWorst(unsuitable) as CatalogModel[]),
  ]

  return ordered
}
