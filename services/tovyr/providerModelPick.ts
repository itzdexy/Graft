import {
  getDefaultModelId,
  sortModelsBestToWorst,
} from '../../scripts/tovyr-provider-catalog.js'
import {
  isOfficialClaudeProvider,
  modelLooksLikeClaude,
} from '../../scripts/tovyr-model-compat.js'
import { getProvider } from '../../scripts/tovyr-providers.js'

function isModelProviderMismatch(model: string, providerId: string): boolean {
  const provider = getProvider(providerId)
  if (!provider || !model) return false
  if (provider.models?.some(m => m.id === model)) return false
  const tovyr = modelLooksLikeClaude(model)
  const official = isOfficialClaudeProvider(provider)
  if (tovyr && !official) return true
  if (!tovyr && official && !provider.anyModel) {
    const listed = provider.models?.some(m => m.id === model)
    if (!listed && provider.models && provider.models.length > 0) {
      return true
    }
  }
  return false
}

/** Best model from static catalog when live /v1/models list is empty or exhausted. */
export function pickBestCatalogModel(
  providerId: string,
  exclude?: Set<string>,
): string | null {
  const def = getProvider(providerId)
  const defaultModel = getDefaultModelId(def)
  const catalogOrder = sortModelsBestToWorst(def?.models ?? []).map(m => m.id)
  const candidates = [defaultModel, ...catalogOrder].filter(
    (id): id is string => !!id,
  )

  for (const id of candidates) {
    if (exclude?.has(id)) continue
    if (isModelProviderMismatch(id, providerId)) continue
    return id
  }
  return null
}

/** Verified API list when warm; otherwise curated catalog default. */
export function pickBestProviderModel(
  providerId: string,
  verified: string[] | null | undefined,
  exclude?: Set<string>,
): string | null {
  if (verified?.length) {
    const fromApi = pickBestVerifiedModel(providerId, verified, exclude)
    if (fromApi) return fromApi
  }
  return pickBestCatalogModel(providerId, exclude)
}

/** Prefer catalog default, then tier-sorted catalog, then remaining API ids. */
export function pickBestVerifiedModel(
  providerId: string,
  verified: string[],
  exclude?: Set<string>,
): string | null {
  if (!verified.length) return null

  const def = getProvider(providerId)
  const defaultModel = getDefaultModelId(def)
  const catalogOrder = sortModelsBestToWorst(def?.models ?? []).map(m => m.id)
  const seen = new Set<string>()
  const ordered: string[] = []

  const push = (id: string) => {
    if (!id || seen.has(id) || !verified.includes(id)) return
    seen.add(id)
    ordered.push(id)
  }

  if (defaultModel) push(defaultModel)
  for (const id of catalogOrder) push(id)
  for (const id of verified) push(id)

  for (const id of ordered) {
    if (exclude?.has(id)) continue
    if (isModelProviderMismatch(id, providerId)) continue
    return id
  }
  return null
}