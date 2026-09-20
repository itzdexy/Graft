import type {
  AgentLoopState,
  AgentLoopStopReason,
  AgentSession,
} from './types.js'
import { createHash } from 'node:crypto'
import {
  AGENT_DEFAULT_MAX_EMPTY_OUTPUTS,
  AGENT_DEFAULT_MAX_REPEATED_FAILURES,
  AGENT_DEFAULT_MAX_TOOL_CALLS,
  AGENT_DEFAULT_MAX_TURNS,
  AGENT_DEFAULT_SESSION_TIMEOUT_MS,
} from './types.js'

export type LoopLimitCheck = {
  allowed: boolean
  reason?: AgentLoopStopReason
  message?: string
}

export type ToolCallRecord = {
  toolName: string
  input: Record<string, unknown>
  ok: boolean
}

const LEAKED_TOOL_MARKERS = [
  '<function_calls>',
  '<invoke name=',
  'tool_name=',
  '{"type":"tool_use"',
]

export function createLoopState(now = Date.now()): AgentLoopState {
  return {
    turnCount: 0,
    toolCallCount: 0,
    startedAt: now,
    repeatedFailureCount: 0,
    emptyOutputCount: 0,
  }
}

export function ensureLoopState(session: AgentSession): AgentLoopState {
  if (!session.loop) {
    session.loop = createLoopState(session.startedAt || Date.now())
  }
  return session.loop
}

export function getSessionLimits(session: AgentSession): {
  maxTurns: number
  maxToolCalls: number
  sessionTimeoutMs: number
  maxRepeatedFailures: number
  maxEmptyOutputs: number
} {
  return {
    maxTurns: session.maxTurns ?? AGENT_DEFAULT_MAX_TURNS,
    maxToolCalls: session.maxToolCalls ?? AGENT_DEFAULT_MAX_TOOL_CALLS,
    sessionTimeoutMs: session.sessionTimeoutMs ?? AGENT_DEFAULT_SESSION_TIMEOUT_MS,
    maxRepeatedFailures: AGENT_DEFAULT_MAX_REPEATED_FAILURES,
    maxEmptyOutputs: AGENT_DEFAULT_MAX_EMPTY_OUTPUTS,
  }
}

/** Compare complete tool inputs without retaining their contents in session state. */
export function toolCallSignature(
  toolName: string,
  input: Record<string, unknown>,
): string {
  const canonical = JSON.stringify(input, (_key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]))
    }
    return value
  })
  return `${toolName}:${createHash('sha256').update(canonical).digest('hex')}`
}

export function isEmptyOrInvalidModelOutput(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  const lower = trimmed.toLowerCase()
  if (LEAKED_TOOL_MARKERS.some(m => lower.includes(m)) && trimmed.length < 120) {
    return true
  }
  return false
}

export function recordAgentTurn(
  session: AgentSession,
  assistantText: string,
  now = Date.now(),
): LoopLimitCheck {
  const loop = ensureLoopState(session)
  loop.turnCount += 1

  if (isEmptyOrInvalidModelOutput(assistantText)) {
    loop.emptyOutputCount += 1
    const limits = getSessionLimits(session)
    if (loop.emptyOutputCount >= limits.maxEmptyOutputs) {
      return stopLoop(
        loop,
        'empty_output',
        `Agent stopped: model returned empty or invalid output ${loop.emptyOutputCount} times. Try rephrasing the goal or switching models.`,
      )
    }
  } else {
    loop.emptyOutputCount = 0
  }

  return checkLoopLimits(session, now)
}

export function recordAgentToolCall(
  session: AgentSession,
  record: ToolCallRecord,
  now = Date.now(),
): LoopLimitCheck {
  const loop = ensureLoopState(session)
  loop.toolCallCount += 1

  const signature = toolCallSignature(record.toolName, record.input)
  if (!record.ok) {
    if (loop.lastFailedToolSignature === signature) {
      loop.repeatedFailureCount += 1
    } else {
      loop.lastFailedToolSignature = signature
      loop.repeatedFailureCount = 1
    }
    const limits = getSessionLimits(session)
    if (loop.repeatedFailureCount >= limits.maxRepeatedFailures) {
      return stopLoop(
        loop,
        'repeated_failure',
        `Agent stopped: the same tool action failed ${loop.repeatedFailureCount} times (${record.toolName}). Change approach or fix the underlying error.`,
      )
    }
  } else {
    loop.repeatedFailureCount = 0
    loop.lastFailedToolSignature = undefined
  }

  return checkLoopLimits(session, now)
}

export function checkLoopLimits(
  session: AgentSession,
  now = Date.now(),
): LoopLimitCheck {
  const loop = ensureLoopState(session)
  if (loop.stopReason) {
    return { allowed: false, reason: loop.stopReason, message: loop.stopMessage }
  }

  const limits = getSessionLimits(session)

  if (loop.turnCount >= limits.maxTurns) {
    return stopLoop(
      loop,
      'max_turns',
      `Agent stopped: reached max turns (${limits.maxTurns}). Use /agent resume to continue or /agent status for summary.`,
    )
  }

  if (loop.toolCallCount >= limits.maxToolCalls) {
    return stopLoop(
      loop,
      'max_tool_calls',
      `Agent stopped: reached max tool calls (${limits.maxToolCalls}). Narrow scope or resume later.`,
    )
  }

  const elapsed = now - loop.startedAt
  if (elapsed >= limits.sessionTimeoutMs) {
    return stopLoop(
      loop,
      'session_timeout',
      `Agent stopped: session timeout (${Math.round(limits.sessionTimeoutMs / 60000)} min). Use /agent resume to continue.`,
    )
  }

  return { allowed: true }
}

function stopLoop(
  loop: AgentLoopState,
  reason: AgentLoopStopReason,
  message: string,
): LoopLimitCheck {
  loop.stopReason = reason
  loop.stopMessage = message
  return { allowed: false, reason, message }
}

export function applyLoopStop(session: AgentSession, check: LoopLimitCheck): AgentSession {
  if (check.allowed) return session
  const step = session.steps[session.currentStepIndex]
  if (step && step.status === 'in_progress') {
    step.status = 'failed'
    step.lastError = check.message
  }
  return {
    ...session,
    phase: 'failed',
    contextNotes: [
      ...session.contextNotes,
      check.message ?? `Stopped: ${check.reason}`,
    ].slice(-10),
    updatedAt: Date.now(),
  }
}

export function formatLoopGuardPrompt(session: AgentSession): string {
  const loop = session.loop ?? createLoopState()
  const limits = getSessionLimits(session)
  const elapsedMin = Math.round((Date.now() - loop.startedAt) / 60000)

  return [
    '## Loop guard (mandatory)',
    `- Turns: ${loop.turnCount}/${limits.maxTurns} · Tool calls: ${loop.toolCallCount}/${limits.maxToolCalls} · Elapsed: ~${elapsedMin}m`,
    '- Do NOT repeat the same failed Bash/Edit/Read action — change inputs or strategy.',
    '- If a tool errors, read the error, fix root cause, then retry once with a different approach.',
    '- If stuck after 2 failures on the same action, ask the user or skip to reflection.',
    '- Empty responses are invalid — always produce a short plan, summary, or tool call.',
    '- One step at a time; mark complete only when verify criteria are met.',
  ].join('\n')
}
