import { sortModelsBestToWorst } from '../../scripts/tovyr-provider-catalog.js'

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
    /\b(70b|72b|90b|405b|340b|480b|235b|large|r1|nemotron-4|deepseek-v3|deepseek-v4|deepseek-r1|glm-5|kimi-k3|grok-4\.5|qwen3)\b/.test(
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
 * Once an active provider has returned a verified model list, show only that
 * list. The static catalog remains a disconnected/setup fallback, never an
 * availability claim that can override live provider data.
 */
export function resolveProviderModelsForPicker(
  provider: PickerProvider,
  verifiedIds: Set<string> | null,
  options: { providerId: string; isActiveProvider: boolean },
): CatalogModel[] {
  const catalog = sortModelsBestToWorst(provider?.models ?? [])
  const shouldUseVerifiedOnly =
    options.isActiveProvider &&
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
