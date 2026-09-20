/**
 * Software Agent SDK — programmatic control surface (OpenHands SDK pattern).
 */

export interface AgentRunOptions {
  prompt: string
  cwd?: string
  model?: string
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
  maxTurns?: number
  sessionId?: string
}

export interface AgentRunResult {
  sessionId: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  success: boolean
  error?: string
}

export type AgentRunner = (opts: AgentRunOptions) => Promise<AgentRunResult>

let runner: AgentRunner | null = null

/** Register the live Graft query loop as the SDK backend. */
export function registerAgentRunner(fn: AgentRunner): void {
  runner = fn
}

export async function runAgent(opts: AgentRunOptions): Promise<AgentRunResult> {
  if (!runner) {
    return {
      sessionId: opts.sessionId ?? `sdk-${Date.now()}`,
      messages: [],
      success: false,
      error:
        'Agent SDK not initialized. Call registerAgentRunner from the CLI entrypoint.',
    }
  }
  return runner(opts)
}

export function isAgentSdkReady(): boolean {
  return runner !== null
}
