import type { ActivateProviderModelResult } from '../../services/graft/activateProviderModel.js'

/** The provider/model that stays live when an activation attempt fails. */
export type ActiveModelSummary = {
  providerLabel: string
  modelId: string | null | undefined
}

export type ModelActivationLock = { current: boolean }

export type RunModelActivationAttemptInput = {
  /**
   * Shared across renders so a second Enter while the first probe is still
   * in flight is dropped instead of racing a second activation.
   */
  lock: ModelActivationLock
  providerId: string
  providerLabel: string
  modelId: string
  active: ActiveModelSummary
  activate: (input: {
    providerId: string
    modelId: string
  }) => Promise<ActivateProviderModelResult>
  /** Fired synchronously so the picker can paint "Checking…" on the same tick. */
  onChecking: (input: { providerLabel: string; modelId: string }) => void
  onSuccess: (result: Extract<ActivateProviderModelResult, { ok: true }>) => void
  /**
   * The result accompanies the message so the caller can distinguish a model
   * that is merely slow (offer to use it anyway) from one that is unusable.
   */
  onFailure: (
    message: string,
    result: Extract<ActivateProviderModelResult, { ok: false }>,
  ) => void
}

function endWithSentence(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return ''
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/**
 * Explains a rejected activation without implying the session changed models.
 * A failed probe leaves the previous selection live, so the message names it.
 */
export function formatModelActivationFailure(
  result: Extract<ActivateProviderModelResult, { ok: false }>,
  active: ActiveModelSummary,
): string {
  const reason = endWithSentence(result.message) || 'This model did not pass its inference check.'
  const stillUsing = active.modelId
    ? ` Still using ${active.providerLabel} · ${active.modelId}.`
    : ''
  return `Not switched — ${reason}${stillUsing}`
}

/**
 * Runs one Enter press through validate → probe → commit, reporting each state
 * back to the picker. Returns true when the model actually became active.
 *
 * The lock is taken synchronously (before the first await) so repeated Enter
 * presses during a slow probe cannot launch overlapping activations, and it is
 * always released so a failed attempt can be retried in place.
 */
export async function runModelActivationAttempt(
  input: RunModelActivationAttemptInput,
): Promise<boolean> {
  if (input.lock.current) return false
  input.lock.current = true
  input.onChecking({
    providerLabel: input.providerLabel,
    modelId: input.modelId,
  })

  try {
    const result = await input.activate({
      providerId: input.providerId,
      modelId: input.modelId,
    })
    if (result.ok) {
      input.onSuccess(result)
      return true
    }
    input.onFailure(formatModelActivationFailure(result, input.active), result)
    return false
  } catch (error) {
    const failure = {
      ok: false as const,
      providerId: input.providerId,
      modelId: input.modelId,
      readiness: 'unknown' as const,
      message: error instanceof Error ? error.message : String(error),
    }
    input.onFailure(formatModelActivationFailure(failure, input.active), failure)
    return false
  } finally {
    input.lock.current = false
  }
}
