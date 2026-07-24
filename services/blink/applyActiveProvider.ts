import type { AppState } from '../../state/AppStateStore.js'
import { clearApiKeyHelperCache } from '../../utils/auth.js'
import { resetSettingsCache } from '../../utils/settings/settingsCache.js'
import { getDefaultModelId, getProvider } from '../../scripts/blink-providers.js'
import { providerNeedsOpenAiCompat } from '../../scripts/blink-provider-upstream.js'
import {
  patchAppStateForBlinkModel,
  syncBlinkModelToSession,
} from './syncModelState.js'
import { warmRepoMapCache } from './repo/repoContext.js'
import {
  fetchActiveProviderModelIds,
  resetProviderModelCache,
  hasWarmProviderModelCache,
} from './providerModels.js'
import { reconcileModelWithVerified } from './validateProviderModel.js'
import { setActiveModel } from '../../scripts/blink-providers.js'
import { applyBlinkActiveProviderToEnv } from './applyProviderEnv.js'

type ActiveProvider = {
  providerId: string
  label: string
  baseUrl: string
  apiKey: string
  model: string
  authMode: 'apiKey' | 'authToken'
}

type ApplyActiveProviderOptions = {
  setAppState?: (f: (prev: AppState) => AppState) => void
}

/** Last provider id hot-applied this process; avoids redundant model-list refetch. */
let lastAppliedProviderId: string | null = null

function applyActiveProviderEnv(active: ActiveProvider): void {
  applyBlinkActiveProviderToEnv({
    providerId: active.providerId,
    baseUrl: active.baseUrl,
    apiKey: active.apiKey,
    model: active.model,
    authMode: active.authMode,
  })
}

/** Hot-apply ~/.blink active provider without restarting Blink. */
export async function applyActiveProviderSession(
  options: ApplyActiveProviderOptions = {},
): Promise<ActiveProvider> {
  const { applyActiveProviderToProcess } = await import(
    '../../scripts/blink-prep-auth.js'
  )
  const active = applyActiveProviderToProcess() as ActiveProvider
  applyActiveProviderEnv(active)
  if (active.model) {
    syncBlinkModelToSession(active.model)
    options.setAppState?.(prev =>
      patchAppStateForBlinkModel(prev, active.model),
    )
  }
  resetSettingsCache()
  clearApiKeyHelperCache()
  const providerChanged = lastAppliedProviderId !== active.providerId
  lastAppliedProviderId = active.providerId
  if (providerChanged) {
    resetProviderModelCache()
  }
  warmRepoMapCache()

  if (providerNeedsOpenAiCompat(getProvider(active.providerId))) {
    const verified = await fetchActiveProviderModelIds({
      force: providerChanged || !hasWarmProviderModelCache(),
    })
    if (verified?.length) {
      const { model: pick, corrected } = reconcileModelWithVerified(
        active.providerId,
        active.model || getDefaultModelId(getProvider(active.providerId)) || '',
        verified,
      )
      if (pick && (corrected || !active.model)) {
        setActiveModel(pick, active.providerId)
        active.model = pick
        applyActiveProviderToProcess()
        applyActiveProviderEnv(active)
        syncBlinkModelToSession(pick)
        options.setAppState?.(prev => patchAppStateForBlinkModel(prev, pick))
      }
    }
  }

  return active
}

export function formatProviderAppliedMessage(
  active: ActiveProvider,
  verifiedCount?: number,
): string {
  const model = active.model ? ` · ${active.model}` : ''
  const verified =
    verifiedCount && verifiedCount > 0 ? ` · ${verifiedCount} models` : ''
  return `${active.label} connected${model}${verified}.`
}
