import { isLocalProviderId } from '../../../scripts/graft-provider-local.js'
import type {
  ProviderConnectionSnapshot,
  ProviderConnectionState,
} from '../../services/graft/providers/types.js'

/**
 * One-line human-readable connection status for the footer badge.
 *
 * Returns `null` when the connection is healthy and the badge should just
 * show the active model. Every other state names what is wrong and how to
 * recover — a bare global "offline" never explains itself.
 */
export function describeConnectionStatus(
  state: ProviderConnectionState,
  connection: Pick<
    ProviderConnectionSnapshot,
    'providerId' | 'providerLabel' | 'detail'
  >,
): string | null {
  const label = connection.providerLabel || connection.providerId || 'provider'
  switch (state) {
    case 'ready':
      return null
    case 'checking':
      return `checking ${label}…`
    case 'limited':
      return 'quota limited'
    case 'degraded':
      return connection.detail?.trim() || 'degraded'
    case 'invalid':
      return 'check key — /provider'
    case 'offline':
      if (connection.providerId && isLocalProviderId(connection.providerId)) {
        return (
          connection.providerId === 'ollama'
            ? 'ollama unreachable — run ollama serve'
            : `${label} unreachable — start local server`
        )
      }
      return 'offline — check network'
    case 'unconfigured':
      return 'no provider — /provider to connect'
  }
}
