import {
  getProvider,
  getActiveProviderId,
  getActiveModelId,
  resolveActive,
  resolveProviderSelection,
  loadState,
  listActivatedProviderIds,
} from '../../../../scripts/graft-providers.js'
import { isLocalProviderId } from '../../../../scripts/graft-provider-local.js'
import { PROVIDER_CATALOG } from '../../../../scripts/graft-provider-catalog.js'
import { providerNeedsOpenAiCompat } from '../../../../scripts/graft-provider-upstream.js'
import type { ModelDescriptor } from '../providers/types.js'
import type { ResolvedProviderSelection } from './types.js'
import { getCachedProviderModelDescriptorsFor } from '../providerModels.js'

export function qualifyModel(providerId: string, modelId: string): string {
  return `${providerId}::${modelId}`
}

export function parseQualifiedModel(value: string): { providerId?: string; modelId: string } {
  const index = value.indexOf('::')
  if (index <= 0) return { modelId: value }
  return { providerId: value.slice(0, index), modelId: value.slice(index + 2) }
}

function toSelection(raw: ReturnType<typeof resolveActive> | ReturnType<typeof resolveProviderSelection>): ResolvedProviderSelection | null {
  if (!raw) return null
  const provider = getProvider(raw.providerId)
  if (!provider || !raw.baseUrl || !raw.model) return null
  return {
    providerId: raw.providerId,
    providerLabel: provider.label,
    modelId: raw.model,
    baseUrl: raw.baseUrl,
    apiKey: raw.apiKey,
    authMode: (raw.authMode || 'apiKey') as ResolvedProviderSelection['authMode'],
    protocol: providerNeedsOpenAiCompat(provider) ? 'openai' : 'anthropic',
  }
}

export function getActivePlatformSelection(): ResolvedProviderSelection | null {
  return toSelection(resolveActive())
}

export function resolvePlatformSelection(providerId: string, modelId?: string): ResolvedProviderSelection | null {
  const parsed = modelId ? parseQualifiedModel(modelId) : undefined
  const resolvedProvider = parsed?.providerId || providerId
  return toSelection(resolveProviderSelection(resolvedProvider, parsed?.modelId || modelId))
}

function catalogDescriptors(providerId: string): ModelDescriptor[] {
  const provider = getProvider(providerId, loadState()) as any
  if (!provider) return []
  return (provider.models || []).map((model: any) => ({
    id: model.id,
    displayName: model.label || model.id,
    available: true,
    contextTokens: null,
    maxOutputTokens: null,
    supportsTools: null,
    supportsVision: null,
    supportsReasoning: null,
    supportsStreaming: true,
    lifecycle: 'active' as const,
    source: 'catalog' as const,
  }))
}

export function listPlatformModels(providerId?: string): ModelDescriptor[] {
  const ids = providerId ? [providerId] : Object.keys(PROVIDER_CATALOG)
  const result: ModelDescriptor[] = []
  for (const id of ids) {
    const live = getCachedProviderModelDescriptorsFor(id)
    const models = live?.length ? live : catalogDescriptors(id)
    for (const model of models) result.push({ ...model, id: qualifyModel(id, model.id) })
  }
  return result
}

/** Models exposed to integrations should come from providers configured by the user. */
export function listConnectedPlatformModels(state = loadState()): ModelDescriptor[] {
  const providerIds = listActivatedProviderIds(state).filter(providerId => {
    // Local providers are opt-in for integrations; Graft should not advertise
    // the Ollama catalog merely because its default endpoint exists.
    return !isLocalProviderId(providerId) || Boolean(state.models?.[providerId])
  })
  return providerIds.flatMap(providerId => listPlatformModels(providerId))
}

export function getActiveProviderAndModel(): { providerId: string; modelId: string } {
  const state = loadState()
  const providerId = getActiveProviderId(state)
  return { providerId, modelId: getActiveModelId(providerId, state) }
}
