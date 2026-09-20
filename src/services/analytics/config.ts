/**
 * Shared analytics configuration
 *
 * Common logic for determining when analytics should be disabled
 * across all analytics systems (Datadog, 1P)
 */

import { isEnvTruthy } from '../../utils/envUtils.js'
import { isTelemetryDisabled } from '../../utils/privacyLevel.js'
import { isGraftRuntime } from '../../utils/graftRuntime.js'

/**
 * Check if analytics operations should be disabled
 *
 * Analytics is disabled in the following cases:
 * - Graft runtime, always (see below)
 * - Test environment (NODE_ENV === 'test')
 * - Third-party cloud providers (Bedrock/Vertex)
 * - Privacy level is no-telemetry or essential-traffic
 */
export function isAnalyticsDisabled(): boolean {
  // Graft never emits telemetry.
  //
  // This was on by default and shipped upstream's event schema to
  // /api/event_logging/batch and Datadog. Graft points ANTHROPIC_BASE_URL at
  // whichever provider the user connected, so those events were being sent
  // outward on the user's own credentials — to a provider that never asked
  // for them and cannot read them. There is no Graft analytics backend, so
  // there is nothing here to make optional.
  if (isGraftRuntime()) return true

  return (
    process.env.NODE_ENV === 'test' ||
    isEnvTruthy(process.env.GRAFT_CODE_USE_BEDROCK) ||
    isEnvTruthy(process.env.GRAFT_CODE_USE_VERTEX) ||
    isEnvTruthy(process.env.GRAFT_CODE_USE_FOUNDRY) ||
    isTelemetryDisabled()
  )
}

/**
 * Check if the feedback survey should be suppressed.
 *
 * Unlike isAnalyticsDisabled(), this does NOT block on 3P providers
 * (Bedrock/Vertex/Foundry). The survey is a local UI prompt with no
 * transcript data — enterprise customers capture responses via OTEL.
 */
export function isFeedbackSurveyDisabled(): boolean {
  return process.env.NODE_ENV === 'test' || isTelemetryDisabled()
}
