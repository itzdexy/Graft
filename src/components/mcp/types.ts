import type {
  ConfigScope,
  MCPServerConnection,
  McpClaudeAIProxyServerConfig,
  McpHTTPServerConfig,
  McpSSEServerConfig,
  McpStdioServerConfig,
} from '../../services/mcp/types.js'

/**
 * An MCP server entry shown in the /mcp UI, paired with its live connection
 * state and the resolved config for its transport.
 */
export type StdioServerInfo = {
  name: string
  client: MCPServerConnection
  scope: ConfigScope
  transport: 'stdio'
  config: McpStdioServerConfig
}

export type SSEServerInfo = {
  name: string
  client: MCPServerConnection
  scope: ConfigScope
  transport: 'sse'
  /** Whether OAuth tokens/session auth are known-good for this server */
  isAuthenticated?: boolean
  config: McpSSEServerConfig
}

export type HTTPServerInfo = {
  name: string
  client: MCPServerConnection
  scope: ConfigScope
  transport: 'http'
  /** Whether OAuth tokens/session auth are known-good for this server */
  isAuthenticated?: boolean
  config: McpHTTPServerConfig
}

export type ClaudeAIServerInfo = {
  name: string
  client: MCPServerConnection
  scope: ConfigScope
  transport: 'claudeai-proxy'
  isAuthenticated?: boolean
  config: McpClaudeAIProxyServerConfig
}

export type ServerInfo =
  | StdioServerInfo
  | SSEServerInfo
  | HTTPServerInfo
  | ClaudeAIServerInfo

/**
 * An MCP server declared in agent frontmatter. These servers only connect
 * when their source agent runs, so they are surfaced separately in /mcp.
 * `command` is set for stdio transports; `url` for sse/http/ws transports.
 */
export type AgentMcpServerInfo = {
  name: string
  /** Names of agents that reference this server */
  sourceAgents: string[]
  transport: 'stdio' | 'sse' | 'http' | 'ws'
  command?: string
  url?: string
  needsAuth: boolean
  isAuthenticated?: boolean
}

/**
 * Navigation state for the /mcp settings dialog screens.
 */
export type MCPViewState =
  | { type: 'list'; defaultTab?: string }
  | { type: 'server-menu'; server: ServerInfo }
  | { type: 'server-tools'; server: ServerInfo }
  | { type: 'server-tool-detail'; server: ServerInfo; toolIndex: number }
  | { type: 'agent-server-menu'; agentServer: AgentMcpServerInfo }
