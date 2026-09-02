/**
 * What the boot screen says about the session it is about to open.
 *
 * The launch screen previously proved only that the process was alive. The
 * first thing a user actually wants to know is which provider and model they
 * are about to talk to — especially after switching, and especially on a cold
 * Windows start where the wait is long enough to wonder.
 *
 * Every lookup is defensive: this renders before AppStateProvider exists and
 * before any provider call has been made, so a missing or corrupt config must
 * degrade to "no provider connected", never to a crash on the launch screen.
 */

export type BootTarget = {
  providerLabel: string
  /** Empty when no model has been chosen yet. */
  modelLabel: string
}

/** Human summary of the active provider/model, or null when none is set up. */
export function describeBootTarget(): BootTarget | null {
  try {
    // Required lazily: the boot screen is on the critical path and must not
    // pull the provider graph in just to render a spinner.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const providers = require('../../../../scripts/tovyr-providers.js') as {
      loadState: () => unknown
      getActiveProviderId: (state?: unknown) => string
      getActiveModelId: (providerId: string, state?: unknown) => string
      getProvider: (id: string, state?: unknown) => { label?: string } | null
    }

    const state = providers.loadState()
    const providerId = providers.getActiveProviderId(state)
    if (!providerId) return null

    const provider = providers.getProvider(providerId, state)
    const modelId = providers.getActiveModelId(providerId, state) || ''

    return {
      providerLabel: provider?.label || providerId,
      modelLabel: modelId,
    }
  } catch {
    return null
  }
}
