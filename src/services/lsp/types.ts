/**
 * Lifecycle state of a single LSP server instance.
 *
 * Transitions:
 * - stopped → starting → running
 * - running → stopping → stopped
 * - any → error (on failure)
 * - error → starting (on retry)
 */
export type LspServerState =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error'

/**
 * Configuration for an LSP server, as declared in plugin .lsp.json files or
 * plugin manifest `lspServers` entries (mirrors LspServerConfigSchema).
 */
export type LspServerConfig = {
  /** Command to execute the LSP server (e.g., "typescript-language-server") */
  command: string
  /** Command-line arguments to pass to the server */
  args?: string[]
  /**
   * Mapping from file extension (with dot, e.g., ".ts") to LSP language ID.
   * Must have at least one entry; file extensions and languages derive from it.
   */
  extensionToLanguage: Record<string, string>
  /** Communication transport mechanism */
  transport?: 'stdio' | 'socket'
  /** Environment variables to set when starting the server */
  env?: Record<string, string>
  /** Initialization options passed to the server during initialization */
  initializationOptions?: unknown
  /** Settings passed to the server via workspace/didChangeConfiguration */
  settings?: unknown
  /** Workspace folder path to use for the server */
  workspaceFolder?: string
  /** Maximum time to wait for server startup (milliseconds) */
  startupTimeout?: number
  /** Maximum time to wait for graceful shutdown (milliseconds) */
  shutdownTimeout?: number
  /** Whether to restart the server if it crashes (not yet implemented) */
  restartOnCrash?: boolean
  /** Maximum number of restart attempts before giving up */
  maxRestarts?: number
}

/**
 * An LSP server config scoped to the plugin that provided it. Server names
 * are prefixed with `plugin:<pluginName>:` to avoid cross-plugin conflicts.
 */
export type ScopedLspServerConfig = LspServerConfig & {
  scope: 'dynamic'
  /** Name of the plugin that provided this server */
  source: string
}
