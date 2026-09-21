import type { AppState } from '../../state/AppStateStore.js'
import { sortModelsBestToWorst } from '../../../scripts/graft-provider-catalog.js'
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
} from '../../../scripts/graft-providers.js'
import { providerNeedsOpenAiCompat } from '../../../scripts/graft-provider-upstream.js'
import {
  isOfficialClaudeProvider,
  modelLooksLikeClaude,
} from '../../../scripts/graft-model-compat.js'
import type { AssistantMessage } from '../../types/message.js'
import { isGraftRuntime } from '../../utils/graftRuntime.js'
import { applyActiveProviderSession } from './applyActiveProvider.js'
import { pickBestCatalogModel, pickBestProviderModel, pickBestVerifiedModel } from './providerModelPick.js'
import {
  fetchActiveProviderModelIds,
  getCachedProviderModelIds,
  getCachedProviderModelIdsFor,
  hasWarmProviderModelCache,
} from './providerModels.js'
import {
  reconcileModelWithVerified,
  resolveModelInVerifiedList,
  isModelVerifiedForProvider,
} from './validateProviderModel.js'
import {
  patchAppStateForGraftModel,
  syncGraftModelToSession,
} from './syncModelState.js'
import {
  applyGraftActiveProviderToEnv,
  reapplyGraftProviderEnvFromDisk,
} from './applyProviderEnv.js'
import {
  formatSelfHealNotice,
  planModelSelfHeal,
} from './models/selfHeal.js'
import {
  classifyProviderError,
  isQuotaErrorText,
  isRateLimitErrorText,
  shouldAttemptProviderFailover,
} from './providerErrors.js'
import {
  markProviderModelUnavailable,
} from './modelAvailability.js'
import {
  resetActiveProviderProbeCache,
  scheduleActiveProviderProbe,
} from './providers/probe.js'

export type GraftModelGuardResult =
  | { ok: true; model: string; switched?: boolean; notice?: string }
  | { ok: false; noKey: true; message: string }

export type FailoverPlan = {
  providerId: string
  providerLabel: string
  model: string
  reason: string
}

/** User-visible notice when auto-failover switches provider or model. */
export function formatGraftFailoverNotice(plan: FailoverPlan): string {
  return [
    `Provider fallback: switched to ${plan.providerLabel} · ${plan.model}.`,
    `Reason: ${plan.reason}.`,
    'Retrying your request with the new model.',
    'Change defaults anytime with `/model` or `graft provider model <id>`.',
  ].join('\n')
}

/** Models already tried and rejected this session, so healing cannot loop. */
const healAttempts = new Set<string>()

/** Test seam. */
export function resetModelSelfHealAttempts(): void {
  healAttempts.clear()
}

/**
 * The saved model no longer exists on the provider — switch to one that does.
 *
 * Previously Graft only printed a suggestion, so a retired model left the chat
 * permanently broken: every message returned the same notice and nothing ever
 * changed. Healing applies the switch and says what it did.
 */
export function healUnavailableActiveModel(failedModel: string): string | null {
  const active = resolveActive()
  if (!active) return null

  const liveIds = getCachedProviderModelIds() ?? []
  if (liveIds.length === 0) return null

  healAttempts.add(failedModel)

  const preferred = pickBestVerifiedModel(
    active.providerId,
    liveIds,
    new Set(healAttempts),
  )

  const plan = planModelSelfHeal({
    failedModel,
    liveIds,
    preferred: preferred ? [preferred] : [],
    exclude: healAttempts,
  })
  if (!plan) return null

  markProviderModelUnavailable(
    active.providerId,
    failedModel,
    'provider no longer serves this model',
  )
  setActiveModel(plan.to, active.providerId)
  syncGraftModelToSession(plan.to)
  reapplyGraftProviderEnvFromDisk()

  return formatSelfHealNotice(plan, active.label)
}
/** Actionable message when the active model 404s or is unavailable on the provider. */
export function formatGraftModelUnavailableMessage(failedModel: string): string {
  const switchCmd = '/model'
  const active = resolveActive()
  if (!active) {
    return `The model "${failedModel}" could not be used because no provider API key is connected. After connecting a key, run ${switchCmd} to pick a verified model.\n\n${formatGraftNoApiKeyHelp()}`
  }

  // Prefer actually fixing it over telling the user to fix it.
  const healed = healUnavailableActiveModel(failedModel)
  if (healed) return healed

  const verified = getCachedProviderModelIds()
  const fallback = verified?.length
    ? pickBestProviderModel(active.providerId, verified, new Set([failedModel]))
    : pickBestCatalogModel(active.providerId, new Set([failedModel]))

  let msg = `The model "${failedModel}" is not available on ${active.label}.`
  if (fallback) {
    msg += `\n\nSuggested: ${fallback}\n\nRun ${switchCmd} to pick a verified model (✓).`
  } else if (isGraftCrossProviderFailoverEnabled()) {
    msg += `\n\nGraft may try another verified model automatically.\n\nRun ${switchCmd} to pick one manually.`
  } else {
    msg += `\n\nRun ${switchCmd} — models with a ✓ in the list are verified for your API key.`
  }
  return msg
}

/** User-facing help when no provider API key is saved. */
export function formatGraftNoApiKeyHelp(): string {
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
    'Keys stay in ~/.graft/providers.json on this computer.',
  )
  return lines.join('\n')
}

export function isModelProviderMismatch(
  model: string,
  providerId: string,
): boolean {
  const provider = getProvider(providerId)
  if (!provider || !model) return false
  if (getCachedProviderModelIdsFor(providerId)?.includes(model)) return false
  if (provider.models?.some(m => m.id === model)) return false
  const graft = modelLooksLikeClaude(model)
  const official = isOfficialClaudeProvider(provider)
  if (graft && !official) return true
  if (!graft && official && !provider.anyModel) {
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

/**
 * Same-provider model hop eligibility (always safe — stays on the user's
 * provider). Includes 404s plus hung/empty streams that leave the UI on
 * "Still no response".
 */
export function shouldAttemptSameProviderModelRecovery(text: string): boolean {
  if (!text.trim()) return false
  if (isRateLimitErrorText(text) || isQuotaErrorText(text)) return false
  if (isModelUnavailableErrorText(text)) return true
  const t = text.toLowerCase()
  // A timeout is NOT a broken model.
  //
  // "stream timed out" used to swap the user's model out from under them, so
  // a reasoning model that thought for longer than the (45s) budget was
  // replaced mid-session by whatever else was verified. The right response to
  // slow is to wait — the budgets above are now measured in minutes, and the
  // user can press Esc. Only genuinely empty or absent output counts as a
  // model that cannot do the job.
  if (
    t.includes('empty stream') ||
    t.includes('returned an empty stream') ||
    t.includes('no model output') ||
    t.includes('returned no model output')
  ) {
    return true
  }
  const classified = classifyProviderError({ message: text })
  return (
    classified.kind === 'bad_response' ||
    classified.kind === 'invalid_model' ||
    classified.kind === 'model_unavailable'
  )
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

export function isGraftCrossProviderFailoverEnabled(): boolean {
  const v = process.env.GRAFT_CROSS_PROVIDER_FAILOVER?.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

/** Off by default — model 404s should not auto-hop providers/models. */
export function isGraftAutoFailoverEnabled(): boolean {
  const v = process.env.GRAFT_AUTO_FAILOVER?.trim().toLowerCase()
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
 * every turn. No-op for non-Graft or non-compat providers; never throws.
 */
export async function ensureGraftModelCacheWarm(
  options: { force?: boolean } = {},
): Promise<void> {
  if (!isGraftRuntime()) return
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
 * already on. Unlike findGraftFailoverPlan this is intentionally NOT gated
 * behind GRAFT_AUTO_FAILOVER — switching to a verified model on the provider
 * the user already chose is always safe and is the expected recovery (no
 * cross-provider hopping). Returns null when no verified alternative exists.
 */
export function findGraftSameProviderVerifiedPlan(
  failedModel: string,
  failedModelsOnProvider: string[] = [],
): FailoverPlan | null {
  if (!isGraftRuntime()) return null
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

function isPremiumClaudeModel(modelId: string): boolean {
  return /\b(opus|fable|mythos)\b/i.test(modelId)
}

function isBudgetClaudeModel(modelId: string): boolean {
  return /\b(haiku|sonnet)\b/i.test(modelId) && !isPremiumClaudeModel(modelId)
}

export function ensureGraftCompatibleModel(
  currentModel: string,
): GraftModelGuardResult {
  if (!isGraftRuntime()) {
    return { ok: true, model: currentModel }
  }

  const active = resolveActive()
  if (!active) {
    return { ok: false, noKey: true, message: formatGraftNoApiKeyHelp() }
  }

  const def = getProvider(active.providerId)
  const verified = getCachedProviderModelIds()
  const needsOpenAiCompat = providerNeedsOpenAiCompat(def)

  const sessionModel = (currentModel || '').trim()
  const configuredModel = (active.model || getDefaultModelId(def) || '').trim()

  // Prefer the session / UI model when it is already valid for this provider.
  // Forcing disk `active.model` every turn was hopping users onto Opus/Fable
  // (credits) after they had connected with Haiku.
  const sessionMismatch =
    !!sessionModel &&
    (isModelProviderMismatch(sessionModel, active.providerId) ||
      (modelLooksLikeClaude(sessionModel) && !isOfficialClaudeProvider(def)))

  if (needsOpenAiCompat && verified?.length) {
    const resolvedSession = sessionModel
      ? resolveModelInVerifiedList(sessionModel, verified)
      : null
    if (resolvedSession) {
      return { ok: true, model: resolvedSession }
    }
    if (sessionModel && !isModelVerifiedForProvider(sessionModel, verified)) {
      const best = pickBestProviderModel(
        active.providerId,
        verified,
        new Set([sessionModel]),
      )
      if (best) {
        return {
          ok: true,
          model: best,
          switched: true,
          notice: `Switched to ${active.label} · ${best} (${sessionModel} is not on your key).`,
        }
      }
    }
    const reconciled = reconcileModelWithVerified(
      active.providerId,
      configuredModel || sessionModel,
      verified,
    )
    if (reconciled.model && reconciled.model !== sessionModel) {
      return {
        ok: true,
        model: reconciled.model,
        switched: true,
        notice: `Switched to ${active.label} · ${reconciled.model} (verified for your key).`,
      }
    }
    return {
      ok: true,
      model: reconciled.model || sessionModel || configuredModel,
    }
  }

  // Native Anthropic / non-compat: keep the session pick unless it is wrong.
  if (sessionModel && !sessionMismatch) {
    // Never silently upgrade Haiku/Sonnet → Opus/Fable (credits wall).
    if (
      configuredModel &&
      configuredModel !== sessionModel &&
      isBudgetClaudeModel(sessionModel) &&
      isPremiumClaudeModel(configuredModel)
    ) {
      return { ok: true, model: sessionModel }
    }
    return { ok: true, model: sessionModel }
  }

  if (configuredModel && configuredModel !== sessionModel) {
    return {
      ok: true,
      model: configuredModel,
      switched: true,
      notice: `Switched to ${active.label} · ${configuredModel} (${
        sessionMismatch
          ? `${sessionModel} is not valid for ${active.label}`
          : `using ${active.label}'s configured model`
      }).`,
    }
  }

  return { ok: true, model: sessionModel || configuredModel }
}

export function findGraftFailoverPlan(
  failedModel: string,
  excludeProviderIds: string[] = [],
  failedModelsOnProvider: string[] = [],
): FailoverPlan | null {
  if (!isGraftRuntime() || !isGraftAutoFailoverEnabled()) return null

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

  if (!isGraftCrossProviderFailoverEnabled()) {
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

export async function applyGraftFailoverPlan(
  plan: FailoverPlan,
  options?: {
    setAppState?: (f: (prev: AppState) => AppState) => void
  },
): Promise<void> {
  const providerId = getActiveProviderId()
  const failed = getActiveModelId(providerId)
  if (failed) {
    markProviderModelUnavailable(
      providerId,
      failed,
      `Failed before switching to ${plan.model}`,
    )
  }
  setActiveProvider(plan.providerId)
  setActiveModel(plan.model, plan.providerId)
  // Do not await reconcile — a force /v1/models refresh can overwrite the
  // failover target with an unranked API id (e.g. CodeLlama).
  await applyActiveProviderSession({
    ...options,
    awaitModelVerification: false,
  })
}

export async function applyGraftModelCorrection(
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
  applyGraftActiveProviderToEnv({
    providerId: active.providerId,
    baseUrl: active.baseUrl,
    apiKey: active.apiKey,
    model,
    authMode: active.authMode,
  })
  syncGraftModelToSession(model)
  options?.setAppState?.(prev => patchAppStateForGraftModel(prev, model))
  resetActiveProviderProbeCache()
  scheduleActiveProviderProbe({ force: true })
  return model
}

/** Re-apply OpenAI-compat proxy routing after a model 404 (settings may have clobbered env). */
export function repairGraftOpenAiCompatRouting(): void {
  if (!isGraftRuntime()) return
  const active = resolveActive()
  if (!active) return
  const def = getProvider(active.providerId)
  if (!providerNeedsOpenAiCompat(def)) return
  reapplyGraftProviderEnvFromDisk()
}
