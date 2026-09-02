/** Reserved in-process MCP server names for Tovyr builtins. */

export const TOVYR_SEQUENTIAL_THINKING_SERVER_NAME = 'tovyr-sequential-thinking'
export const TOVYR_MEMORY_GRAPH_SERVER_NAME = 'tovyr-memory'

export function isTovyrSequentialThinkingServer(name: string): boolean {
  return normalizeMcpServerName(name) === TOVYR_SEQUENTIAL_THINKING_SERVER_NAME
}

export function isTovyrMemoryGraphServer(name: string): boolean {
  return normalizeMcpServerName(name) === TOVYR_MEMORY_GRAPH_SERVER_NAME
}

export function isTovyrBuiltinMcpServer(name: string): boolean {
  return (
    isTovyrSequentialThinkingServer(name) ||
    isTovyrMemoryGraphServer(name)
  )
}

function normalizeMcpServerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}
