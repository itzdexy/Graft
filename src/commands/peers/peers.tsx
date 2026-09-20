import type { LocalJSXCommandContext } from '../../commands.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { listSessionPeers } from '../../utils/peerRegistry.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
): Promise<null> {
  const peers = await listSessionPeers()
  onDone(
    peers.length === 0
      ? 'No other live local Graft sessions found.'
      : [
          'Live Graft peers:',
          ...peers.map(peer => {
            const name = peer.name ? `${peer.name} · ` : ''
            const status = peer.status ? ` · ${peer.status}` : ''
            return `${name}${peer.sessionId}${status}\n  ${peer.cwd}\n  ${peer.address}`
          }),
        ].join('\n'),
  )
  return null
}
