import type { AppState } from '../../state/AppStateStore.js'
import { isCatalogModel } from '../../scripts/tovyr-provider-catalog.js'
import {
  getActiveProviderId,
  getProvider,
  loadState,
  saveState,
  setActiveModel,
  setActiveProvider,
} from '../../scripts/tovyr-providers.js'
import { applyActiveProviderSession } from './applyActiveProvider.js'
import type { ModelReadinessState } from './modelReadiness.js'
import { getCachedProviderModelIds } from './providerModels.js'
import { probeProviderModel } from './providers/probe.js'
import {
  validateModelForProvider,
  type ModelValidationResult,
} from './validateProviderModel.js'

export type ActivateProviderModelInput = {
  providerId: string
  modelId: string
  requireTools?: boolean
  allowSlow?: boolean
  setAppState?: (f: (prev: AppState) => AppState) => void
}

type ProbeResult = {
  ok: boolean
  latencyMs: number
  readiness: ModelReadinessState
  detail?: string
}

export type ActivateProviderModelDependencies = {
  validate?: (
    input: ActivateProviderModelInput,
  ) => Promise<ModelValidationResult>
  probe?: (input: ActivateProviderModelInput) => Promise<ProbeResult>
  commit?: (input: ActivateProviderModelInput & { modelId: string }) => Promise<void>
  /** Injectable session application keeps activation rollback testable. */
  apply?: (options: {
    setAppState?: (f: (prev: AppState) => AppState) => void
    awaitModelVerification?: boolean
  }) => Promise<unknown>
}

export type ActivateProviderModelResult =
  | {
      ok: true
      providerId: string
      modelId: string
      readiness: 'ready' | 'chat_only' | 'slow'
    }
  | {
      ok: false
      providerId: string
      modelId: string
      readiness: ModelReadinessState
      message: string
    }

async function defaultValidate(
  input: ActivateProviderModelInput,
): Promise<ModelValidationResult> {
  if (input.providerId === getActiveProviderId()) {
    return validateModelForProvider(input.providerId, input.modelId)
  }
  const provider = getProvider(input.providerId)
  if (!provider) return { ok: false, message: 'Unknown provider.' }
  if (!isCatalogModel(provider, input.modelId)) {
    return {
      ok: false,
      message: `Model "${input.modelId}" is not supported by ${provider.label}.`,
    }
  }
  return { ok: true, model: input.modelId, corrected: false }
}

async function defaultCommit(
  input: ActivateProviderModelInput & { modelId: string },
  apply = applyActiveProviderSession,
): Promise<void> {
  // The provider file has several coupled maps (active, models, keys, auth,
  // endpoints and custom metadata). Keep an immutable whole-state snapshot:
  // rolling back just the visible provider/model loses a candidate's saved
  // model or turns an absent entry into a persisted default.
  const before = JSON.parse(JSON.stringify(loadState()))
  try {
    setActiveProvider(input.providerId)
    setActiveModel(input.modelId, input.providerId)
    await apply({ setAppState: input.setAppState })
  } catch (error) {
    // Restore the exact persisted state before reapplying process/session
    // settings. This also restores candidate model absence, custom endpoint
    // metadata, and the previous active provider/model as one transaction.
    saveState(before)
    await apply({
      setAppState: input.setAppState,
      awaitModelVerification: false,
    }).catch(() => {})
    throw error
  }
}

/** True when the provider's own live /models inventory lists this id. */
function isModelListedByProvider(providerId: string, modelId: string): boolean {
  if (providerId !== getActiveProviderId()) return false
  return (getCachedProviderModelIds() ?? []).includes(modelId)
}

export async function activateProviderModel(
  input: ActivateProviderModelInput,
  dependencies: ActivateProviderModelDependencies = {},
): Promise<ActivateProviderModelResult> {
  const validate = dependencies.validate ?? defaultValidate
  const probe =
    dependencies.probe ??
    (candidate =>
      probeProviderModel({
        providerId: candidate.providerId,
        modelId: candidate.modelId,
      }))
  const commit =
    dependencies.commit ??
    (candidate => defaultCommit(candidate, dependencies.apply ?? applyActiveProviderSession))

  const validation = await validate(input)
  if (!validation.ok) {
    return {
      ok: false,
      providerId: input.providerId,
      modelId: input.modelId,
      readiness: 'unknown',
      message: validation.message,
    }
  }

  const candidate = { ...input, modelId: validation.model }
  const readiness = await probe(candidate)
  // A model the provider lists in its own live inventory exists; a probe
  // timeout means it was slow to warm, not that it is unusable. Large MoE and
  // reasoning models routinely exceed the probe budget on a cold first token,
  // and refusing them made real models permanently unselectable.
  const listedByProvider = isModelListedByProvider(
    input.providerId,
    validation.model,
  )
  const acceptable =
    readiness.ok ||
    (readiness.readiness === 'slow' &&
      (input.allowSlow === true || listedByProvider))
  if (!acceptable) {
    return {
      ok: false,
      providerId: input.providerId,
      modelId: validation.model,
      readiness: readiness.readiness,
      message: readiness.detail ?? 'This model did not pass its inference check.',
    }
  }
  if (input.requireTools && readiness.readiness === 'chat_only') {
    return {
      ok: false,
      providerId: input.providerId,
      modelId: validation.model,
      readiness: 'chat_only',
      message: 'This model can chat but did not verify tool support.',
    }
  }

  try {
    await commit(candidate)
  } catch (error) {
    return {
      ok: false,
      providerId: input.providerId,
      modelId: validation.model,
      readiness: readiness.readiness,
      message: error instanceof Error ? error.message : String(error),
    }
  }

  return {
    ok: true,
    providerId: input.providerId,
    modelId: validation.model,
    readiness: readiness.readiness as 'ready' | 'chat_only' | 'slow',
  }
}
