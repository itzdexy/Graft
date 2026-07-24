/** Reserved in-process MCP server names for Blink builtins. */

export const BLINK_SEQUENTIAL_THINKING_SERVER_NAME = 'blink-sequential-thinking'
export const BLINK_MEMORY_GRAPH_SERVER_NAME = 'blink-memory'

export function isBlinkSequentialThinkingServer(name: string): boolean {
  return normalizeMcpServerName(name) === BLINK_SEQUENTIAL_THINKING_SERVER_NAME
}

export function isBlinkMemoryGraphServer(name: string): boolean {
  return normalizeMcpServerName(name) === BLINK_MEMORY_GRAPH_SERVER_NAME
}

export function isBlinkBuiltinMcpServer(name: string): boolean {
  return (
    isBlinkSequentialThinkingServer(name) ||
    isBlinkMemoryGraphServer(name)
  )
}

function normalizeMcpServerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}
