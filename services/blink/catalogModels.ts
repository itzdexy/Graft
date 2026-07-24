import { sortModelsBestToWorst } from '../../scripts/blink-provider-catalog.js'
import { providerNeedsOpenAiCompat } from '../../scripts/blink-provider-upstream.js'

export type CatalogModel = {
  id: string
  label: string
  tier: 'opus' | 'sonnet' | 'haiku'
  context?: string
}

/** Display label for a model id returned by GET /v1/models but missing from the static catalog. */
export function humanizeOpenAiModelId(modelId: string): string {
  const slug = modelId.includes('/') ? modelId.split('/').pop()! : modelId
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bIt\b/g, 'IT')
    .replace(/\bAi\b/g, 'AI')
    .replace(/\bNv\b/g, 'NV')
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
    /\b(70b|72b|90b|405b|340b|large|r1|nemotron-4|deepseek-v3|deepseek-r1)\b/.test(
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
} | null

/**
 * For OpenAI-compat providers with a verified model list, show only models the
 * active API key can use (plus labels for ids not in the static catalog).
 */
export function resolveProviderModelsForPicker(
  provider: PickerProvider,
  verifiedIds: Set<string> | null,
  options: { providerId: string; isActiveProvider: boolean },
): CatalogModel[] {
  const catalog = sortModelsBestToWorst(provider?.models ?? [])
  const shouldUseVerifiedOnly =
    options.isActiveProvider &&
    providerNeedsOpenAiCompat(provider) &&
    verifiedIds &&
    verifiedIds.size > 0

  if (!shouldUseVerifiedOnly) {
    return catalog
  }

  const catalogById = new Map(catalog.map((m: CatalogModel) => [m.id, m]))
  const merged: CatalogModel[] = []
  const seen = new Set<string>()

  for (const id of verifiedIds) {
    if (seen.has(id)) continue
    seen.add(id)
    const hit = catalogById.get(id)
    if (hit) {
      merged.push(hit)
    } else {
      merged.push({
        id,
        label: humanizeOpenAiModelId(id),
        tier: inferModelTier(id),
      })
    }
  }

  return sortModelsBestToWorst(merged)
}
