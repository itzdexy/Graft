import type { EcosystemUpstreamId } from '../../services/blink/ecosystem/types.js'
import { getUpstreamHelp } from '../../services/blink/ecosystem/upstreamHelp.js'
import type { LocalCommandCall } from '../../types/command.js'

export function makeUpstreamShortcutCall(id: EcosystemUpstreamId): LocalCommandCall {
  return async () => ({ type: 'text', value: getUpstreamHelp(id) })
}
