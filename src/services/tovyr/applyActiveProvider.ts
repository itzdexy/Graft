import type { AppState } from '../../state/AppStateStore.js'
import { clearApiKeyHelperCache } from '../../utils/auth.js'
import { resetSettingsCache } from '../../utils/settings/settingsCache.js'
import { getDefaultModelId, getProvider } from '../../../scripts/tovyr-providers.js'
import { providerNeedsOpenAiCompat } from '../../../scripts/tovyr-provider-upstream.js'
import {
  patchAppStateForTovyrModel,
  syncTovyrModelToSession,
} from './syncModelState.js'
import { warmRepoMapCache } from './repo/repoContext.js'
import {
  fetchActiveProviderModelIds,
  resetProviderModelCache,
  hasWarmProviderModelCache,
} from './providerModels.js'
import { reconcileModelWithVerified } from './validateProviderModel.js'
import { setActiveModel } from '../../../scripts/tovyr-providers.js'
import { applyTovyrActiveProviderToEnv } from './applyProviderEnv.js'
import {
  resetActiveProviderProbeCache,
  scheduleActiveProviderProbe,
} from './providers/probe.js'

type ActiveProvider = {
  providerId: string
  label: string
  baseUrl: string
  apiKey: string
  model: string
  authMode: 'apiKey' | 'authToken' | 'oauth'
}

type ApplyActiveProviderOptions = {
  setAppState?: (f: (prev: AppState) => AppState) => void
  /**
   * Provider/model pickers wait for verification so they can immediately show
   * a corrected model. Startup must not wait on remote model-list endpoints.
   */
  awaitModelVerification?: boolean
}

/** Last provider id hot-applied this process; avoids redundant model-list refetch. */
let lastAppliedProviderId: string | null = null

function applyActiveProviderEnv(active: ActiveProvider): void {
  applyTovyrActiveProviderToEnv({
    providerId: active.providerId,
    baseUrl: active.baseUrl,
    apiKey: active.apiKey,
    model: active.model,
    authMode: active.authMode,
  })
}

/** Hot-apply ~/.tovyr active provider without restarting Tovyr. */
export async function applyActiveProviderSession(
  options: ApplyActiveProviderOptions = {},
): Promise<ActiveProvider> {
  const { applyActiveProviderToProcess } = await import(
    '../../../scripts/tovyr-prep-auth.js'
  )
  const active = applyActiveProviderToProcess() as ActiveProvider
  applyActiveProviderEnv(active)
  if (active.model) {
    syncTovyrModelToSession(active.model)
    options.setAppState?.(prev =>
      patchAppStateForTovyrModel(prev, active.model),
    )
  }
  resetSettingsCache()
  clearApiKeyHelperCache()
  const providerChanged = lastAppliedProviderId !== active.providerId
  lastAppliedProviderId = active.providerId
  if (providerChanged) {
    resetProviderModelCache()
  }
  resetActiveProviderProbeCache()
  warmRepoMapCache()

  const verifyAndReconcileModel = async (): Promise<void> => {
    if (!providerNeedsOpenAiCompat(getProvider(active.providerId))) return

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
        syncTovyrModelToSession(pick)
        options.setAppState?.(prev => patchAppStateForTovyrModel(prev, pick))
      }
    }
  }

  if (options.awaitModelVerification === false) {
    void verifyAndReconcileModel().catch(() => {
      // Model discovery is best-effort during startup. /model and the first
      // provider request can retry without delaying the initial UI.
    })
  } else {
    await verifyAndReconcileModel()
  }

  scheduleActiveProviderProbe({ force: true })
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
