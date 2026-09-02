import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { feature } from '../../utils/features.js'
import { lazySchema } from '../../utils/lazySchema.js'
import {
  listSessionPeers,
  type SessionPeer,
} from '../../utils/peerRegistry.js'
import { LIST_PEERS_TOOL_NAME } from './constants.js'
import { DESCRIPTION, getPrompt } from './prompt.js'

const inputSchema = lazySchema(() => z.strictObject({}))
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
  z.object({
    peers: z.array(
      z.object({
        pid: z.number(),
        sessionId: z.string(),
        cwd: z.string(),
        kind: z.enum(['interactive', 'bg', 'daemon', 'daemon-worker']),
        address: z.string(),
        name: z.string().optional(),
        status: z.enum(['busy', 'idle', 'waiting']).optional(),
        updatedAt: z.number().optional(),
      }),
    ),
  }),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type ListPeersOutput = { peers: SessionPeer[] }

export const ListPeersTool = buildTool({
  name: LIST_PEERS_TOOL_NAME,
  searchHint: 'discover messageable local coding sessions',
  maxResultSizeChars: 100_000,
  alwaysLoad: true,
  get inputSchema(): InputSchema {
    return inputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },
  async description() {
    return DESCRIPTION
  },
  async prompt() {
    return getPrompt()
  },
  isEnabled() {
    return feature('UDS_INBOX')
  },
  isReadOnly() {
    return true
  },
  isConcurrencySafe() {
    return true
  },
  renderToolUseMessage() {
    return null
  },
  async call() {
    return { data: { peers: await listSessionPeers() } }
  },
  mapToolResultToToolResultBlockParam(content, toolUseID) {
    const peers = (content as ListPeersOutput).peers
    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content:
        peers.length === 0
          ? 'No other live local Tovyr sessions were found.'
          : peers
              .map(peer => {
                const label = peer.name ? `${peer.name} · ` : ''
                const status = peer.status ? ` · ${peer.status}` : ''
                return `${label}${peer.sessionId}${status}\n  ${peer.cwd}\n  ${peer.address}`
              })
              .join('\n'),
    }
  },
} satisfies ToolDef<InputSchema, ListPeersOutput>)
