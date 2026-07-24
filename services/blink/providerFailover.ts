import type { AppState } from '../../state/AppStateStore.js'
import { sortModelsBestToWorst } from '../../scripts/blink-provider-catalog.js'
import {
  getActiveProviderId,
  getActiveModelId,
  getDefaultModelId,
  getProvider,
  listActivatedProviderIds,
  loadState,
  resolveActive,
  setActiveModel,
  setActiveProvider,
} from '../../scripts/blink-providers.js'
import { providerNeedsOpenAiCompat } from '../../scripts/blink-provider-upstream.js'
import {
  isOfficialClaudeProvider,
  modelLooksLikeClaude,
} from '../../scripts/blink-model-compat.js'
import type { AssistantMessage } from '../../types/message.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import { applyActiveProviderSession } from './applyActiveProvider.js'
import { pickBestCatalogModel, pickBestProviderModel, pickBestVerifiedModel } from './providerModelPick.js'
import {
  fetchActiveProviderModelIds,
  getCachedProviderModelIds,
  hasWarmProviderModelCache,
} from './providerModels.js'
import {
  reconcileModelWithVerified,
  resolveModelInVerifiedList,
  isModelVerifiedForProvider,
} from './validateProviderModel.js'
import {
  patchAppStateForBlinkModel,
  syncBlinkModelToSession,
} from './syncModelState.js'
import {
  applyBlinkActiveProviderToEnv,
  reapplyBlinkProviderEnvFromDisk,
} from './applyProviderEnv.js'
import {
  classifyProviderError,
  isRateLimitErrorText,
  shouldAttemptProviderFailover,
} from './providerErrors.js'

export type BlinkModelGuardResult =
  | { ok: true; model: string; switched?: boolean; notice?: string }
  | { ok: false; noKey: true; message: string }

export type FailoverPlan = {
  providerId: string
  providerLabel: string
  model: string
  reason: string
}

/** User-visible notice when auto-failover switches provider or model. */
export function formatBlinkFailoverNotice(plan: FailoverPlan): string {
  return [
    `Provider fallback: switched to ${plan.providerLabel} · ${plan.model}.`,
    `Reason: ${plan.reason}.`,
    'Retrying your request with the new model.',
    'Change defaults anytime with `/model` or `blink provider model <id>`.',
  ].join('\n')
}

/** Actionable message when the active model 404s or is unavailable on the provider. */
export function formatBlinkModelUnavailableMessage(failedModel: string): string {
  const switchCmd = '/model'
  const active = resolveActive()
  if (!active) {
    return `The model "${failedModel}" could not be used because no provider API key is connected. After connecting a key, run ${switchCmd} to pick a verified model.\n\n${formatBlinkNoApiKeyHelp()}`
  }

  const verified = getCachedProviderModelIds()
  const fallback = verified?.length
    ? pickBestProviderModel(active.providerId, verified, new Set([failedModel]))
    : pickBestCatalogModel(active.providerId, new Set([failedModel]))

  let msg = `The model "${failedModel}" is not available on ${active.label}.`
  if (fallback) {
    msg += `\n\nSuggested: ${fallback}\n\nRun ${switchCmd} to pick a verified model (✓).`
  } else if (isBlinkCrossProviderFailoverEnabled()) {
    msg += `\n\nBlink may try another verified model automatically.\n\nRun ${switchCmd} to pick one manually.`
  } else {
    msg += `\n\nRun ${switchCmd} — models with a ✓ in the list are verified for your API key.`
  }
  return msg
}

/** User-facing help when no provider API key is saved. */
export function formatBlinkNoApiKeyHelp(): string {
  const providerId = getActiveProviderId()
  const def = getProvider(providerId)
  const lines = [
    'No provider connected.',
    'Run /provider to choose a provider, then paste its API key.',
  ]
  if (def?.signup) {
    lines.push(`Get a key: ${def.signup}`)
  } else {
    lines.push(
      'Create a key on your provider website, then run /provider.',
    )
  }
  lines.push(
    'Keys stay in ~/.blink/providers.json on this computer.',
  )
  return lines.join('\n')
}

export function isModelProviderMismatch(
  model: string,
  providerId: string,
): boolean {
  const provider = getProvider(providerId)
  if (!provider || !model) return false
  if (provider.models?.some(m => m.id === model)) return false
  const claude = modelLooksLikeClaude(model)
  const official = isOfficialClaudeProvider(provider)
  if (claude && !official) return true
  if (!claude && official && !provider.anyModel) {
    const listed = provider.models?.some(m => m.id === model)
    if (!listed && provider.models && provider.models.length > 0) {
      return true
    }
  }
  return false
}

export function isModelUnavailableErrorText(text: string): boolean {
  if (isRateLimitErrorText(text)) return false
  const classified = classifyProviderError({ message: text })
  if (
    classified.kind === 'rate_limit' ||
    classified.kind === 'quota_exceeded' ||
    classified.kind === 'auth_failed'
  ) {
    return false
  }
  const t = text.toLowerCase()
  if (
    t.includes('model_not_found') ||
    t.includes('unknown model') ||
    t.includes('no such model') ||
    t.includes('invalid model') ||
    t.includes('is not valid for this provider') ||
    t.includes('issue with the selected model')
  ) {
    return true
  }
  if (t.includes('does not exist') && t.includes('model')) {
    return true
  }
  if (t.includes('not available on')) {
    return true
  }
  if (t.includes('not available') && (t.includes('model') || t.includes('deployment'))) {
    return true
  }
  if (t.includes('may not have access') && t.includes('model')) {
    return true
  }
  return false
}

/** Classify assistant error text for failover decisions. */
export function classifyAssistantProviderError(
  text: string,
): ReturnType<typeof classifyProviderError> {
  return classifyProviderError({ message: text })
}

export function shouldFailoverForAssistantError(text: string): boolean {
  const classified = classifyAssistantProviderError(text)
  return shouldAttemptProviderFailover(classified.kind)
}

export function getAssistantErrorText(message: AssistantMessage): string {
  const content = message.message.content
  if (!Array.isArray(content)) return ''
  return content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n')
}

export function isBlinkCrossProviderFailoverEnabled(): boolean {
  const v = process.env.BLINK_CROSS_PROVIDER_FAILOVER?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/** Off by default — model 404s should not auto-hop providers/models. */
export function isBlinkAutoFailoverEnabled(): boolean {
  const v = process.env.BLINK_AUTO_FAILOVER?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export { pickBestVerifiedModel } from './providerModelPick.js'

function nextVerifiedModelOnProvider(
  providerId: string,
  triedModels: Set<string>,
): string | null {
  const verified = getCachedProviderModelIds()
  if (!verified?.length) return null
  return pickBestProviderModel(providerId, verified, triedModels)
}

/**
 * Warm the live model list (GET /v1/models) for OpenAI-compat providers so the
 * model guard can rewrite an unavailable or free-form model to a verified one
 * BEFORE the first request. Providers like NVIDIA NIM accept any model id
 * locally but the upstream 404s on ids it doesn't actually serve; without this
 * warm-up the guard has no list to correct against and the bad model 404s on
 * every turn. No-op for non-Blink or non-compat providers; never throws.
 */
export async function ensureBlinkModelCacheWarm(
  options: { force?: boolean } = {},
): Promise<void> {
  if (!isBlinkRuntime()) return
  const active = resolveActive()
  if (!active) return
  if (!providerNeedsOpenAiCompat(getProvider(active.providerId))) return
  if (!options.force && hasWarmProviderModelCache()) return
  try {
    await fetchActiveProviderModelIds({ force: options.force })
  } catch {
    // Best-effort: a cold/failed fetch just leaves existing behavior in place.
  }
}

/**
 * After a model 404, pick a verified model on the SAME provider the user is
 * already on. Unlike findBlinkFailoverPlan this is intentionally NOT gated
 * behind BLINK_AUTO_FAILOVER — switching to a verified model on the provider
 * the user already chose is always safe and is the expected recovery (no
 * cross-provider hopping). Returns null when no verified alternative exists.
 */
export function findBlinkSameProviderVerifiedPlan(
  failedModel: string,
  failedModelsOnProvider: string[] = [],
): FailoverPlan | null {
  if (!isBlinkRuntime()) return null
  const active = resolveActive()
  if (!active) return null
  const def = getProvider(active.providerId)
  if (!providerNeedsOpenAiCompat(def)) return null

  const triedModels = new Set([failedModel, ...failedModelsOnProvider])
  const verifiedNext = nextVerifiedModelOnProvider(active.providerId, triedModels)
  if (!verifiedNext) return null

  return {
    providerId: active.providerId,
    providerLabel: def?.label ?? active.providerId,
    model: verifiedNext,
    reason: `verified model on ${def?.label ?? active.providerId}`,
  }
}

export function ensureBlinkCompatibleModel(
  currentModel: string,
): BlinkModelGuardResult {
  if (!isBlinkRuntime()) {
    return { ok: true, model: currentModel }
  }

  const active = resolveActive()
  if (!active) {
    return { ok: false, noKey: true, message: formatBlinkNoApiKeyHelp() }
  }

  const def = getProvider(active.providerId)
  const verified = getCachedProviderModelIds()
  const needsOpenAiCompat = providerNeedsOpenAiCompat(def)

  let sessionModel = currentModel
  let targetModel =
    active.model ||
    getDefaultModelId(def) ||
    sessionModel

  if (needsOpenAiCompat && verified?.length) {
    const reconciled = reconcileModelWithVerified(
      active.providerId,
      targetModel,
      verified,
    )
    targetModel = reconciled.model

    const resolvedCurrent = resolveModelInVerifiedList(sessionModel, verified)
    if (resolvedCurrent) {
      sessionModel = resolvedCurrent
    } else if (!isModelVerifiedForProvider(sessionModel, verified)) {
      const best = pickBestProviderModel(active.providerId, verified, new Set([sessionModel]))
      if (best) {
        return {
          ok: true,
          model: best,
          switched: true,
          notice: `Switched to ${active.label} · ${best} (${sessionModel} is not on your key).`,
        }
      }
    }
  } else if (needsOpenAiCompat) {
    // Cold / empty verified list — still avoid sending a random saved id that 404s.
    const best = pickBestProviderModel(active.providerId, [], new Set([sessionModel]))
    if (best && best !== sessionModel) {
      return {
        ok: true,
        model: best,
        switched: true,
        notice: `Switched to ${active.label} · ${best} (${sessionModel} is not available).`,
      }
    }
  }

  const mismatch =
    isModelProviderMismatch(sessionModel, active.providerId) ||
    (modelLooksLikeClaude(sessionModel) &&
      !isOfficialClaudeProvider(def))

  if (targetModel && targetModel !== sessionModel) {
    const reason = mismatch
      ? `${sessionModel} is not valid for ${active.label}`
      : `using ${active.label}'s configured model`
    return {
      ok: true,
      model: targetModel,
      switched: true,
      notice: `Switched to ${active.label} · ${targetModel} (${reason}).`,
    }
  }

  return { ok: true, model: sessionModel }
}

export function findBlinkFailoverPlan(
  failedModel: string,
  excludeProviderIds: string[] = [],
  failedModelsOnProvider: string[] = [],
): FailoverPlan | null {
  if (!isBlinkRuntime() || !isBlinkAutoFailoverEnabled()) return null

  const state = loadState()
  const activated = listActivatedProviderIds(state).filter(
    id => !excludeProviderIds.includes(id),
  )
  if (activated.length === 0) return null

  const currentId = getActiveProviderId(state)
  const tryCurrent =
    activated.includes(currentId) && !excludeProviderIds.includes(currentId)

  const triedModels = new Set([failedModel, ...failedModelsOnProvider])

  if (tryCurrent) {
    const def = getProvider(currentId, state)
    const verifiedNext = nextVerifiedModelOnProvider(currentId, triedModels)
    if (verifiedNext) {
      return {
        providerId: currentId,
        providerLabel: def?.label ?? currentId,
        model: verifiedNext,
        reason: `verified model on ${def?.label ?? currentId}`,
      }
    }

    if (providerNeedsOpenAiCompat(def)) {
      return null
    }

    const catalog = sortModelsBestToWorst(def?.models ?? [])
    for (const entry of catalog) {
      if (triedModels.has(entry.id)) continue
      if (isModelProviderMismatch(entry.id, currentId)) continue
      return {
        providerId: currentId,
        providerLabel: def?.label ?? currentId,
        model: entry.id,
        reason: `next catalog model on ${def?.label ?? currentId}`,
      }
    }
  }

  if (!isBlinkCrossProviderFailoverEnabled()) {
    return null
  }

  for (const id of activated) {
    if (id === currentId) continue
    if (excludeProviderIds.includes(id)) continue
    const def = getProvider(id, state)
    const model = getActiveModelId(id, state) || getDefaultModelId(def)
    if (!model || triedModels.has(model)) continue
    if (isModelProviderMismatch(model, id)) continue
    return {
      providerId: id,
      providerLabel: def?.label ?? id,
      model,
      reason: `alternate provider after ${failedModel} failed`,
    }
  }

  return null
}

export async function applyBlinkFailoverPlan(
  plan: FailoverPlan,
  options?: {
    setAppState?: (f: (prev: AppState) => AppState) => void
  },
): Promise<void> {
  setActiveProvider(plan.providerId)
  setActiveModel(plan.model, plan.providerId)
  await applyActiveProviderSession(options)
}

export async function applyBlinkModelCorrection(
  model: string,
  providerId?: string,
  options?: {
    setAppState?: (f: (prev: AppState) => AppState) => void
  },
): Promise<string> {
  const id = providerId ?? getActiveProviderId()
  setActiveModel(model, id)
  const active = resolveActive()
  if (!active) return model

  // Model-only switch: update env + session without re-fetching /v1/models
  // (applyActiveProviderSession force-refetches and can add 15–30s per turn).
  applyBlinkActiveProviderToEnv({
    providerId: active.providerId,
    baseUrl: active.baseUrl,
    apiKey: active.apiKey,
    model,
    authMode: active.authMode,
  })
  syncBlinkModelToSession(model)
  options?.setAppState?.(prev => patchAppStateForBlinkModel(prev, model))
  return model
}

/** Re-apply OpenAI-compat proxy routing after a model 404 (settings may have clobbered env). */
export function repairBlinkOpenAiCompatRouting(): void {
  if (!isBlinkRuntime()) return
  const active = resolveActive()
  if (!active) return
  const def = getProvider(active.providerId)
  if (!providerNeedsOpenAiCompat(def)) return
  reapplyBlinkProviderEnvFromDisk()
}
