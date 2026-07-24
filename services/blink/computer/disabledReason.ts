/**
 * Pure helpers for why Computer Use (Chicago) is disabled — testable without GB/auth mocks.
 */

export type ChicagoGateInput = {
  userType: string | undefined
  monorepoRootDir: string | undefined
  allowAntComputerUse: boolean
  subscriptionTier: string | undefined
  featureEnabled: boolean
}

export function hasComputerUseSubscription(
  userType: string | undefined,
  subscriptionTier: string | undefined,
): boolean {
  if (userType === 'ant') {
    return true
  }
  return subscriptionTier === 'max' || subscriptionTier === 'pro'
}

export function isAntMonorepoComputerUseBlocked(input: ChicagoGateInput): boolean {
  return (
    input.userType === 'ant' &&
    Boolean(input.monorepoRootDir?.trim()) &&
    !input.allowAntComputerUse
  )
}

/** User-facing reason when Computer Use tools are unavailable; undefined if enabled. */
export function getChicagoDisabledReason(input: ChicagoGateInput): string | undefined {
  if (isAntMonorepoComputerUseBlocked(input)) {
    return (
      'Computer use is disabled in the monorepo dev shell. ' +
      'Set ALLOW_ANT_COMPUTER_USE_MCP=1 to enable, or run Blink outside the monorepo environment.'
    )
  }
  if (!hasComputerUseSubscription(input.userType, input.subscriptionTier)) {
    return (
      'Computer use requires a Max or Pro subscription. ' +
      'Upgrade your plan or use another approach (shell commands, file tools).'
    )
  }
  if (!input.featureEnabled) {
    return (
      'Computer use is not enabled for this account yet. ' +
      'It may roll out gradually — check Blink settings or documentation for availability.'
    )
  }
  return undefined
}

export function isChicagoEnabledFromInput(input: ChicagoGateInput): boolean {
  return getChicagoDisabledReason(input) === undefined
}