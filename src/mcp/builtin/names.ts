/** Reserved in-process MCP server names for Graft builtins. */

export const GRAFT_SEQUENTIAL_THINKING_SERVER_NAME = 'graft-sequential-thinking'
export const GRAFT_MEMORY_GRAPH_SERVER_NAME = 'graft-memory'

export function isGraftSequentialThinkingServer(name: string): boolean {
  return normalizeMcpServerName(name) === GRAFT_SEQUENTIAL_THINKING_SERVER_NAME
}

export function isGraftMemoryGraphServer(name: string): boolean {
  return normalizeMcpServerName(name) === GRAFT_MEMORY_GRAPH_SERVER_NAME
}

export function isGraftBuiltinMcpServer(name: string): boolean {
  return (
    isGraftSequentialThinkingServer(name) ||
    isGraftMemoryGraphServer(name)
  )
}

function normalizeMcpServerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}
