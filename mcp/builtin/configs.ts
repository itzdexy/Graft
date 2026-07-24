import type { ScopedMcpServerConfig } from '../../services/mcp/types.js'
import { isBlinkRuntime } from '../../utils/blinkRuntime.js'
import {
  BLINK_MEMORY_GRAPH_SERVER_NAME,
  BLINK_SEQUENTIAL_THINKING_SERVER_NAME,
} from './names.js'

/** Placeholder stdio configs — client.ts runs these in-process instead of spawning. */
export function getBlinkBuiltinMcpServerConfigs(): Record<
  string,
  ScopedMcpServerConfig
> {
  if (!isBlinkRuntime()) return {}
  if (process.env.BLINK_BUILTIN_MCP === '0') return {}

  const stub: ScopedMcpServerConfig = {
    type: 'stdio',
    command: 'node',
    args: ['-e', '0'],
    scope: 'user',
  }

  return {
    [BLINK_SEQUENTIAL_THINKING_SERVER_NAME]: {
      ...stub,
      env: { BLINK_BUILTIN_MCP: 'sequential-thinking' },
    },
    [BLINK_MEMORY_GRAPH_SERVER_NAME]: {
      ...stub,
      env: { BLINK_BUILTIN_MCP: 'memory-graph' },
    },
  }
}
