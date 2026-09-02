/**
 * Turns the provider catalog + saved state into the rows `/provider` renders.
 *
 * Pure on purpose: the ordering rules ("connected first", "hide media APIs
 * until they are searched for") are the part that is easy to get wrong and
 * impossible to eyeball in a terminal screenshot.
 */

import type { ProviderSearchRow } from './pickerSearch.js'

export type ProviderCatalogEntry = {
  id: string
  label: string
  category: string
  keyHint?: string
  anyModel?: boolean
}

export type ProviderCategoryGroup = {
  id: string
  label: string
  providers: readonly ProviderCatalogEntry[]
}

export type BuildProviderRowsInput = {
  categories: readonly ProviderCategoryGroup[]
  activeProviderId: string
  /** Providers with a valid saved key. */
  connectedIds: ReadonlySet<string>
  /** Providers that run on this machine (Ollama, LM Studio, …). */
  localIds: ReadonlySet<string>
  isOnline: boolean
  /**
   * When false, image/voice/video APIs are omitted. They cannot run agent
   * work, so they are noise in a list whose purpose is "pick a coding model" —
   * but they stay reachable, because a query surfaces them (see
   * `shouldIncludeMediaProviders`).
   */
  includeMedia?: boolean
}

export const CONNECTED_GROUP = 'Connected'

export function isMediaCategory(category: string): boolean {
  return category.startsWith('media_')
}

/**
 * Media providers are hidden from the default list and revealed only when the
 * user is clearly looking for one. Hiding them outright would be a lie about
 * what Tovyr supports; showing 21 of them above the chat providers buries the
 * thing almost everyone opened this dialog for.
 */
export function shouldIncludeMediaProviders(query: string): boolean {
  return query.trim().length > 0
}

/**
 * Rows for the provider picker.
 *
 * With no query the list is grouped: connected providers first (that is what
 * the user is switching between day to day), then the catalog by category.
 * Callers rank the result with `searchProviders`, which drops the grouping —
 * a ranked result list re-grouped by category reads as random.
 */
export function buildProviderRows(
  input: BuildProviderRowsInput,
): ProviderSearchRow[] {
  const connectedRows: ProviderSearchRow[] = []
  const catalogRows: ProviderSearchRow[] = []
  const seen = new Set<string>()

  for (const category of input.categories) {
    if (!input.includeMedia && isMediaCategory(category.id)) continue

    for (const entry of category.providers) {
      // Each provider appears exactly once. An earlier draft also repeated the
      // connected ones inside their category section, which read fine
      // unfiltered but made every search return the same provider twice
      // ("claude" → Anthropic, Anthropic).
      if (seen.has(entry.id)) continue

      const local = input.localIds.has(entry.id)
      // Offline: a remote provider cannot be verified or used, so offering it
      // only produces a failed probe.
      if (!input.isOnline && !local) continue

      seen.add(entry.id)
      const connected = local || input.connectedIds.has(entry.id)
      const row: ProviderSearchRow = {
        id: entry.id,
        label: entry.label,
        category: category.id,
        categoryLabel: category.label,
        keyHint: entry.keyHint,
        connected,
        local,
        active: entry.id === input.activeProviderId,
        anyModel: entry.anyModel,
      }

      if (connected) connectedRows.push(row)
      else catalogRows.push(row)
    }
  }

  connectedRows.sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return a.label.localeCompare(b.label)
  })

  return [...connectedRows, ...catalogRows]
}

export type ProviderRowPresentation = {
  badge: string
  badgeTone: 'success' | 'warning' | 'accent' | 'muted'
  detail: string
}

/** Right-hand status chip and dim detail text for one provider row. */
export function presentProviderRow(
  row: ProviderSearchRow,
): ProviderRowPresentation {
  const detail = [
    row.local ? 'local runtime' : row.keyHint,
    row.anyModel ? 'any model id' : null,
    isMediaCategory(row.category) ? 'not a chat model' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  if (row.active) return { badge: 'active', badgeTone: 'accent', detail }
  if (row.local) return { badge: 'ready', badgeTone: 'success', detail }
  if (row.connected) return { badge: 'key saved', badgeTone: 'success', detail }
  return { badge: '', badgeTone: 'muted', detail }
}

/**
 * Group heading for a row in the *unfiltered* list. Returns undefined while a
 * query is active, so ranked results render as one flat list.
 */
export function providerRowGroup(
  row: ProviderSearchRow,
  index: number,
  connectedCount: number,
  query: string,
): string | undefined {
  if (query.trim()) return undefined
  return index < connectedCount ? CONNECTED_GROUP : row.categoryLabel
}
