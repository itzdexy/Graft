import type { ScopedMcpServerConfig } from '../../services/mcp/types.js'
import { isTovyrRuntime } from '../../utils/tovyrRuntime.js'
import {
  TOVYR_MEMORY_GRAPH_SERVER_NAME,
  TOVYR_SEQUENTIAL_THINKING_SERVER_NAME,
} from './names.js'

/** Placeholder stdio configs — client.ts runs these in-process instead of spawning. */
export function getTovyrBuiltinMcpServerConfigs(): Record<
  string,
  ScopedMcpServerConfig
> {
  if (!isTovyrRuntime()) return {}
  if (process.env.TOVYR_BUILTIN_MCP === '0') return {}

  const stub: ScopedMcpServerConfig = {
    type: 'stdio',
    command: 'node',
    args: ['-e', '0'],
    scope: 'user',
  }

  return {
    [TOVYR_SEQUENTIAL_THINKING_SERVER_NAME]: {
      ...stub,
      env: { TOVYR_BUILTIN_MCP: 'sequential-thinking' },
    },
    [TOVYR_MEMORY_GRAPH_SERVER_NAME]: {
      ...stub,
      env: { TOVYR_BUILTIN_MCP: 'memory-graph' },
    },
  }
}
