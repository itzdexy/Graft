import type { EcosystemUpstreamId } from '../../services/tovyr/ecosystem/types.js'
import { getUpstreamHelp } from '../../services/tovyr/ecosystem/upstreamHelp.js'
import type { LocalCommandCall } from '../../types/command.js'

export function makeUpstreamShortcutCall(id: EcosystemUpstreamId): LocalCommandCall {
  return async () => ({ type: 'text', value: getUpstreamHelp(id) })
}
