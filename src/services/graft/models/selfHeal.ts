/**
 * Recovery when the saved model stops existing.
 *
 * Providers retire models. When that happens the saved active model starts
 * returning 404/410 and every single message fails with the same notice — the
 * chat is dead until the user works out they need to run `/model`. Graft knew
 * enough to *suggest* a replacement but never applied one.
 *
 * The decision is a pure function so the ranking and the guard against
 * healing in a loop are testable without touching disk or the network.
 */

export type SelfHealPlan = {
  /** Model to switch to. */
  to: string
  /** Model that failed, for the notice. */
  from: string
}

export type SelfHealInput = {
  failedModel: string
  /** Ids the provider currently serves. */
  liveIds: readonly string[]
  /**
   * Candidate order, best first — normally from pickBestVerifiedModel /
   * the provider's curated list.
   */
  preferred?: readonly string[]
  /** Models already tried and failed this session; never pick these again. */
  exclude?: ReadonlySet<string>
}

/**
 * Choose a replacement model, or null when there is nothing safe to switch to.
 *
 * Returns null rather than guessing when the provider list is unavailable:
 * silently switching to a model we cannot confirm exists would just move the
 * failure, and the user would not know what changed.
 */
export function planModelSelfHeal(input: SelfHealInput): SelfHealPlan | null {
  const failed = input.failedModel.trim()
  if (!failed) return null
  if (input.liveIds.length === 0) return null

  const excluded = new Set(input.exclude ?? [])
  excluded.add(failed)

  const live = new Set(input.liveIds)

  for (const candidate of input.preferred ?? []) {
    if (excluded.has(candidate)) continue
    if (!live.has(candidate)) continue
    return { to: candidate, from: failed }
  }

  for (const candidate of input.liveIds) {
    if (excluded.has(candidate)) continue
    return { to: candidate, from: failed }
  }

  return null
}

/** One-line notice shown in the transcript when a switch happens. */
export function formatSelfHealNotice(
  plan: SelfHealPlan,
  providerLabel: string,
): string {
  return [
    `"${plan.from}" is no longer available on ${providerLabel}.`,
    `Switched to ${plan.to} and retrying.`,
    'Run /model to choose a different one.',
  ].join(' ')
}

/** HTTP statuses and error codes that mean "this model is gone". */
export function isModelGoneError(input: {
  status?: number
  code?: string
  message?: string
}): boolean {
  if (input.status === 404 || input.status === 410) return true
  const code = (input.code ?? '').toLowerCase()
  if (code === 'model_not_found' || code === 'invalid_model') return true
  const message = (input.message ?? '').toLowerCase()
  return (
    message.includes('model_not_found') ||
    message.includes('no endpoints found') ||
    (message.includes('model') &&
      (message.includes('not found') || message.includes('does not exist')))
  )
}
