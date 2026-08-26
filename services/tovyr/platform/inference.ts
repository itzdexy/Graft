import { assertNormalizedRequest, type NormalizedModelRequest, type NormalizedProviderStreamEvent } from './types.js'
import { resolvePlatformSelection } from './providerRegistry.js'
import { adapterForProtocol } from './adapterRegistry.js'
export function streamInference(input: unknown, signal: AbortSignal): AsyncIterable<NormalizedProviderStreamEvent> {
  const request = assertNormalizedRequest(input)
  const parsed = request.model.indexOf('::') > 0 ? request.model.split('::') : [undefined, request.model]
  const selection = resolvePlatformSelection(parsed[0] || 'ollama', parsed[1])
  if (!selection) return (async function* () { yield { type: 'error', kind: 'provider_unavailable', message: 'Provider is not configured or reachable', retryable: false } })()
  return adapterForProtocol(selection.protocol).stream(selection, request, signal)
}
