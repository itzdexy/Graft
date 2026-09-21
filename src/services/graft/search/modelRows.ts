/**
 * Turns per-provider model catalogs into the rows `/model` renders.
 *
 * The picker is provider-agnostic on purpose. The old flow made you choose a
 * provider first and only then showed models, which meant you could not answer
 * "who has Opus?" without walking every provider by hand. Here every connected
 * provider's models live in one searchable list, keyed by `provider/model` the
 * way opencode does it.
 */

import type { ModelSearchRow } from './pickerSearch.js'
import type { ModelDescriptor } from '../providers/types.js'
import { deriveModelTags } from '../models/modelMetadata.js'

/** Human names for the internal tier ids. Shown, and searched, instead of the raw id. */
export const TIER_LABEL: Record<string, string> = {
  opus: 'Best',
  sonnet: 'Balanced',
  haiku: 'Fast',
}

export const TIER_ORDER: Record<string, number> = {
  opus: 0,
  sonnet: 1,
  haiku: 2,
}

export type ModelCatalogEntry = {
  id: string
  label: string
  tier?: string
  context?: string
}

export type ProviderModelSource = {
  providerId: string
  providerLabel: string
  models: readonly ModelCatalogEntry[]
  /** Provider has a saved key or a local runtime. */
  connected: boolean
  /** Accepts arbitrary model ids. */
  anyModel?: boolean
  /** Ids the provider returned from its live /v1/models call. */
  verifiedIds?: ReadonlySet<string>
  /** The model currently selected on this provider. */
  activeModelId?: string
  /** Ids that are known not to work as agent targets. */
  unavailableIds?: ReadonlySet<string>
  /** Live metadata from the provider: pricing, context, modalities. */
  descriptors?: readonly ModelDescriptor[]
  /** Runs on this machine — priced as LOCAL rather than free. */
  local?: boolean
}

export type BuildModelRowsInput = {
  sources: readonly ProviderModelSource[]
  activeProviderId: string
  /**
   * When false (the default) only connected providers contribute rows —
   * offering a model you cannot call is a dead end.
   */
  includeDisconnected?: boolean
}

/**
 * One flat, ranked-by-usefulness list of models.
 *
 * Order with no query: active model, then the active provider's models, then
 * other connected providers; within a provider, best tier first, and
 * provider-verified ids ahead of catalog-only ones.
 */
export function buildModelRows(input: BuildModelRowsInput): ModelSearchRow[] {
  const rows: ModelSearchRow[] = []

  for (const source of input.sources) {
    if (!source.connected && !input.includeDisconnected) continue

    const byId = new Map(
      (source.descriptors ?? []).map(descriptor => [descriptor.id, descriptor]),
    )

    for (const model of source.models) {
      if (source.unavailableIds?.has(model.id)) continue
      const descriptor = byId.get(model.id)
      // Derive tags from the raw metadata rather than reusing the tags stored
      // at fetch time: the cache is persisted for hours, so a formatting
      // change (or a provider that never sent tags) would otherwise show
      // stale text until the next refetch. Stored tags are the fallback for
      // descriptors that carry no raw fields.
      // A local provider is taggable even with no descriptor: LOCAL is a fact
      // about where it runs, not about the model list.
      const derived =
        descriptor || source.local
          ? deriveModelTags({
              pricing: descriptor?.pricing ?? null,
              contextTokens: descriptor?.contextTokens ?? null,
              maxOutputTokens: descriptor?.maxOutputTokens ?? null,
              modalities: descriptor?.modalities,
              supportsTools: descriptor?.supportsTools ?? null,
              supportsVision: descriptor?.supportsVision ?? null,
              local: source.local,
            })
          : []

      rows.push({
        tags:
          derived.length > 0
            ? derived
            : (descriptor?.tags ?? []),
        providerId: source.providerId,
        providerLabel: source.providerLabel,
        modelId: model.id,
        label: model.label,
        tier: model.tier,
        tierLabel: model.tier ? TIER_LABEL[model.tier] : undefined,
        verified: source.verifiedIds?.has(model.id) ?? false,
        active:
          source.providerId === input.activeProviderId &&
          model.id === source.activeModelId,
        connected: source.connected,
      })
    }
  }

  return rows.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1

    const activeProvider = (row: ModelSearchRow) =>
      row.providerId === input.activeProviderId ? 0 : 1
    const providerRank = activeProvider(a) - activeProvider(b)
    if (providerRank !== 0) return providerRank

    if (a.providerId !== b.providerId) {
      return a.providerLabel.localeCompare(b.providerLabel)
    }
    if (a.verified !== b.verified) return a.verified ? -1 : 1

    const tierRank =
      (TIER_ORDER[a.tier ?? ''] ?? 1) - (TIER_ORDER[b.tier ?? ''] ?? 1)
    if (tierRank !== 0) return tierRank

    return a.label.localeCompare(b.label)
  })
}

export type ModelRowPresentation = {
  badge: string
  badgeTone: 'success' | 'warning' | 'accent' | 'muted'
  detail: string
}

/**
 * Detail and badge for a model row.
 *
 * Display the API id verbatim. Provider identity lives separately in the row.
 */
export function presentModelRow(row: ModelSearchRow): ModelRowPresentation {
  // Never turn the search-only provider prefix into a copyable API model id.
  const detail = [row.modelId, ...(row.tags ?? []), row.tierLabel]
    .filter(Boolean)
    .join(' · ')

  if (row.active) return { badge: 'active', badgeTone: 'accent', detail }
  // A free model is the single most useful thing to spot in a long list.
  if (row.tags?.includes('FREE')) {
    return { badge: 'free', badgeTone: 'success', detail }
  }
  if (row.verified) return { badge: 'listed', badgeTone: 'muted', detail }
  return { badge: '', badgeTone: 'muted', detail }
}

/** Group heading for the unfiltered list; suppressed while searching. */
export function modelRowGroup(
  row: ModelSearchRow,
  query: string,
): string | undefined {
  if (query.trim()) return undefined
  return row.providerLabel
}

/** Distinct providers represented in a row set — for the summary counter. */
export function countProviders(rows: readonly ModelSearchRow[]): number {
  return new Set(rows.map(row => row.providerId)).size
}
