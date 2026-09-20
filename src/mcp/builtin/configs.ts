import type { ScopedMcpServerConfig } from '../../services/mcp/types.js'
import { isGraftRuntime } from '../../utils/graftRuntime.js'
import {
  GRAFT_MEMORY_GRAPH_SERVER_NAME,
  GRAFT_SEQUENTIAL_THINKING_SERVER_NAME,
} from './names.js'

/** Placeholder stdio configs — client.ts runs these in-process instead of spawning. */
export function getGraftBuiltinMcpServerConfigs(): Record<
  string,
  ScopedMcpServerConfig
> {
  if (!isGraftRuntime()) return {}
  if (process.env.GRAFT_BUILTIN_MCP === '0') return {}

  const stub: ScopedMcpServerConfig = {
    type: 'stdio',
    command: 'node',
    args: ['-e', '0'],
    scope: 'user',
  }

  return {
    [GRAFT_SEQUENTIAL_THINKING_SERVER_NAME]: {
      ...stub,
      env: { GRAFT_BUILTIN_MCP: 'sequential-thinking' },
    },
    [GRAFT_MEMORY_GRAPH_SERVER_NAME]: {
      ...stub,
      env: { GRAFT_BUILTIN_MCP: 'memory-graph' },
    },
  }
}
