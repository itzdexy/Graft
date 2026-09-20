// Centralized tool progress payload types.
//
// These live here (not in Tool.ts) to break import cycles: tools import them
// directly, and Tool.ts re-exports for backwards compatibility.
import type { Message } from './message.js'

/** Bash/PowerShell streaming output progress. */
export type BashProgress = {
  type: 'bash_progress'
  output: string
  fullOutput: string
  elapsedTimeSeconds?: number
  totalLines?: number
  totalBytes?: number
  taskId?: string
  timeoutMs?: number
}

/** PowerShell uses the same payload as Bash with a distinct discriminator. */
export type PowerShellProgress = Omit<BashProgress, 'type'> & {
  type: 'powershell_progress'
}

/** Shared shell progress accepted by UI surfaces that render either backend. */
export type ShellProgress = BashProgress | PowerShellProgress

/** Incremental workflow phase update emitted to SDK consumers. */
export type SdkWorkflowProgress = {
  type: string
  index: number
  phaseIndex: number
  status?: string
  [key: string]: unknown
}

/** Sub-agent streaming progress. `message` carries nested agent messages. */
export type AgentToolProgress = {
  type: 'agent_progress'
  message: Message
  prompt: string
  agentId: string
}

/** Skill execution streaming progress (same shape as agent progress). */
export type SkillToolProgress = {
  type: 'skill_progress'
  message: Message
  prompt: string
  agentId: string
}

/** MCP tool call lifecycle + protocol progress notifications. */
export type MCPProgress = {
  type: 'mcp_progress'
  status: 'started' | 'completed' | 'failed'
  serverName: string
  toolName: string
  elapsedTimeMs?: number
  progress?: number
  total?: number
  progressMessage?: string
}

/** Web search streaming progress. */
export type WebSearchProgress =
  | { type: 'query_update'; query: string }
  | { type: 'search_results_received'; resultCount: number; query: string }

/** TaskOutput blocking/waiting progress. */
export type TaskOutputProgress = {
  type: 'waiting_for_task'
  taskDescription?: string
  taskType?: string
}

/** REPL tool execution progress. */
export type REPLToolProgress = {
  type: 'repl_progress'
  output?: string
  elapsedTimeSeconds?: number
}

/** Discriminated union of every tool progress payload. */
export type ToolProgressData =
  | BashProgress
  | PowerShellProgress
  | AgentToolProgress
  | SkillToolProgress
  | MCPProgress
  | WebSearchProgress
  | TaskOutputProgress
  | REPLToolProgress
