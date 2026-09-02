import {
  getDefaultModelId,
  sortModelsBestToWorst,
} from '../../../scripts/tovyr-provider-catalog.js'
import {
  isOfficialClaudeProvider,
  modelLooksLikeClaude,
} from '../../../scripts/tovyr-model-compat.js'
import { getProvider } from '../../../scripts/tovyr-providers.js'
import { getProviderModelUnavailableReason } from './modelAvailability.js'
import {
  isAgentSuitableOpenAiModel,
  openAiModelChatPreferenceScore,
} from './openAiModelSuitability.js'

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

function isPickableModel(providerId: string, modelId: string, exclude?: Set<string>): boolean {
  if (!modelId) return false
  if (exclude?.has(modelId)) return false
  if (isModelProviderMismatch(modelId, providerId)) return false
  if (!isAgentSuitableOpenAiModel(modelId)) return false
  if (getProviderModelUnavailableReason(providerId, modelId)) return false
  return true
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
    if (!isPickableModel(providerId, id, exclude)) continue
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

/**
 * Prefer catalog default, then tier-sorted catalog intersection with verified,
 * then remaining suitable API ids ranked for chat. Never auto-pick embeds,
 * CodeLlama, guards, or models marked unavailable.
 */
export function pickBestVerifiedModel(
  providerId: string,
  verified: string[],
  exclude?: Set<string>,
): string | null {
  if (!verified.length) return null

  const def = getProvider(providerId)
  const defaultModel = getDefaultModelId(def)
  const catalogOrder = sortModelsBestToWorst(def?.models ?? []).map(m => m.id)
  const catalogSet = new Set(catalogOrder)
  const seen = new Set<string>()
  const ordered: string[] = []

  const push = (id: string) => {
    if (!id || seen.has(id) || !verified.includes(id)) return
    seen.add(id)
    ordered.push(id)
  }

  if (defaultModel) push(defaultModel)
  for (const id of catalogOrder) push(id)

  // Only auto-pick catalog∩verified first. Remaining API ids are a last resort
  // and must be agent-suitable + chat-preferenced.
  const remainder = verified
    .filter(id => !seen.has(id) && !catalogSet.has(id))
    .filter(id => isAgentSuitableOpenAiModel(id))
    .sort(
      (a, b) =>
        openAiModelChatPreferenceScore(b) - openAiModelChatPreferenceScore(a),
    )
  for (const id of remainder) push(id)

  for (const id of ordered) {
    if (!isPickableModel(providerId, id, exclude)) continue
    return id
  }
  return null
}