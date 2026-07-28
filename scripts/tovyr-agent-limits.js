/** Agent loop defaults — keep in sync with services/tovyr/agent/types.ts */
export const AGENT_LIMITS = {
  maxTurns: 50,
  maxToolCalls: 150,
  sessionTimeoutMinutes: 30,
  maxRepeatedFailures: 3,
  maxEmptyOutputs: 2,
}

export function formatAgentLimitsSummary() {
  const l = AGENT_LIMITS
  return `/agent sessions: max ${l.maxTurns} turns, ${l.maxToolCalls} tool calls, ${l.sessionTimeoutMinutes}m timeout`
}
