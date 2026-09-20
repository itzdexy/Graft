/**
 * Privacy level controls how much nonessential network traffic and telemetry
 * Graft generates.
 *
 * Levels are ordered by restrictiveness:
 *   default < no-telemetry < essential-traffic
 *
 * - default:            Everything enabled (opt-in via GRAFT_CODE_ENABLE_TELEMETRY=1).
 * - no-telemetry:       Analytics/telemetry disabled (Datadog, 1P events, feedback survey).
 * - essential-traffic:  ALL nonessential network traffic disabled
 *                       (telemetry + auto-updates, grove, release notes, model capabilities, etc.).
 *
 * The resolved level is the most restrictive signal from:
 *   GRAFT_CODE_ENABLE_TELEMETRY=1              →  default (opt-in)
 *   GRAFT_CODE_DISABLE_NONESSENTIAL_TRAFFIC  →  essential-traffic
 *   DISABLE_TELEMETRY                         →  no-telemetry
 */

type PrivacyLevel = 'default' | 'no-telemetry' | 'essential-traffic'

export function getPrivacyLevel(): PrivacyLevel {
  if (process.env.GRAFT_CODE_ENABLE_TELEMETRY === '1') {
    return 'default'
  }
  if (process.env.GRAFT_CODE_DISABLE_NONESSENTIAL_TRAFFIC) {
    return 'essential-traffic'
  }
  if (process.env.DISABLE_TELEMETRY) {
    return 'no-telemetry'
  }
  return 'no-telemetry'
}

/**
 * True when all nonessential network traffic should be suppressed.
 * Equivalent to the old `process.env.GRAFT_CODE_DISABLE_NONESSENTIAL_TRAFFIC` check.
 */
export function isEssentialTrafficOnly(): boolean {
  return getPrivacyLevel() === 'essential-traffic'
}

/**
 * True when telemetry/analytics should be suppressed.
 * True at both `no-telemetry` and `essential-traffic` levels.
 */
export function isTelemetryDisabled(): boolean {
  return getPrivacyLevel() !== 'default'
}

/** Machine-readable privacy status for doctor / purge tooling. */
export function getPrivacyStatus(): {
  level: PrivacyLevel
  telemetryEnabled: boolean
  essentialTrafficOnly: boolean
  enableHint: string
} {
  const level = getPrivacyLevel()
  return {
    level,
    telemetryEnabled: level === 'default',
    essentialTrafficOnly: level === 'essential-traffic',
    enableHint:
      level === 'default'
        ? 'Telemetry opted in via GRAFT_CODE_ENABLE_TELEMETRY=1'
        : 'Default is no-telemetry. Set GRAFT_CODE_ENABLE_TELEMETRY=1 to opt in.',
  }
}

/**
 * Returns the env var name responsible for the current essential-traffic restriction,
 * or null if unrestricted. Used for user-facing "unset X to re-enable" messages.
 */
export function getEssentialTrafficOnlyReason(): string | null {
  if (process.env.GRAFT_CODE_DISABLE_NONESSENTIAL_TRAFFIC) {
    return 'GRAFT_CODE_DISABLE_NONESSENTIAL_TRAFFIC'
  }
  return null
}
