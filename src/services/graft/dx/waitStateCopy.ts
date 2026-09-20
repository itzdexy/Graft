/**
 * Shared user-facing copy for first-token wait / stream hang UX.
 * Keep Connecting… escalation and stream-timeout messaging in one place.
 */

export const FIRST_TOKEN_ESCALATE_MS = 10_000
export const FIRST_TOKEN_HELP_MS = 20_000

/** Shown after FIRST_TOKEN_ESCALATE_MS with no tokens (Connecting / Waiting for first token). */
export function formatStillWaitingHint(): string {
  return 'Waiting for model · Esc to stop · /model to switch'
}

/**
 * Live status label escalation for hang-prone phases.
 * Returns null when the base label should be used unchanged.
 */
export function escalateWaitStatusLabel(
  streamMode: string | undefined,
  elapsedMs: number | undefined,
  baseLabel: string,
  connectionState?: string,
): string | null {
  if (elapsedMs == null || elapsedMs < FIRST_TOKEN_ESCALATE_MS) {
    return null
  }
  const hangProne =
    streamMode === 'requesting' ||
    streamMode === 'responding' ||
    streamMode === undefined ||
    streamMode === ''
  // Only escalate while still waiting for first token (no generating yet).
  const waitingForToken =
    hangProne &&
    (baseLabel.includes('Connecting') ||
      baseLabel.includes('Waiting for first token') ||
      baseLabel.includes('Waiting for model'))
  if (!waitingForToken) return null

  const secs = Math.round(elapsedMs / 1000)
  if (connectionState === 'offline' || connectionState === 'invalid') {
    return `Provider ${connectionState} · Esc to stop · /model to switch`
  }
  if (elapsedMs < FIRST_TOKEN_HELP_MS) {
    return connectionState === 'degraded'
      ? `Provider degraded · ${secs}s · Esc to stop`
      : `Provider is slow · ${secs}s · Esc to stop`
  }
  return `Still no response · ${secs}s · Esc to stop · /model to switch`
}

/** Abort / error message when the stream idle watchdog fires. */
export function formatStreamIdleTimeoutMessage(timeoutSec: number): string {
  return (
    `Model stream timed out after ${timeoutSec}s with no response. ` +
    `${formatStillWaitingHint()}. ` +
    'The provider may be cold-starting. ' +
    'Use /provider to switch providers, or set GRAFT_AUTO_FAILOVER=1.'
  )
}
