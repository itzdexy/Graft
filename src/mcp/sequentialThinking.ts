/**
 * Sequential thinking MCP-style tool (MCP Servers pattern).
 * Structured step-by-step reasoning before acting.
 */

export interface ThinkingStep {
  index: number
  thought: string
  revisionOf?: number
  branchFrom?: number
}

export interface SequentialThinkingSession {
  id: string
  problem: string
  steps: ThinkingStep[]
  conclusion?: string
  createdAt: number
}

const sessions = new Map<string, SequentialThinkingSession>()

export function startThinking(problem: string): SequentialThinkingSession {
  const id = `think-${Date.now()}`
  const session: SequentialThinkingSession = {
    id,
    problem,
    steps: [],
    createdAt: Date.now(),
  }
  sessions.set(id, session)
  return session
}

export function addThought(
  sessionId: string,
  thought: string,
  opts?: { revisionOf?: number; branchFrom?: number },
): ThinkingStep | null {
  const s = sessions.get(sessionId)
  if (!s) return null
  const step: ThinkingStep = {
    index: s.steps.length + 1,
    thought,
    revisionOf: opts?.revisionOf,
    branchFrom: opts?.branchFrom,
  }
  s.steps.push(step)
  return step
}

export function concludeThinking(
  sessionId: string,
  conclusion: string,
): SequentialThinkingSession | null {
  const s = sessions.get(sessionId)
  if (!s) return null
  s.conclusion = conclusion
  return s
}

export function formatThinkingForPrompt(s: SequentialThinkingSession): string {
  const lines = [
    '# Sequential thinking',
    `Problem: ${s.problem}`,
    '',
  ]
  for (const step of s.steps) {
    let prefix = `${step.index}.`
    if (step.revisionOf) prefix += ` (revision of ${step.revisionOf})`
    if (step.branchFrom) prefix += ` (branch from ${step.branchFrom})`
    lines.push(`${prefix} ${step.thought}`)
  }
  if (s.conclusion) {
    lines.push('', `Conclusion: ${s.conclusion}`)
  }
  return lines.join('\n')
}

/** Run a simple 3-step think chain for a problem. */
export function quickThinkChain(problem: string): string {
  const s = startThinking(problem)
  addThought(s.id, `Understand: ${problem}`)
  addThought(s.id, 'Plan: identify files, tools, and risks before editing.')
  addThought(s.id, 'Execute: use tools; verify with tests.')
  concludeThinking(s.id, 'Proceed with the plan above.')
  return formatThinkingForPrompt(s)
}

export function getThinkingSession(id: string): SequentialThinkingSession | undefined {
  return sessions.get(id)
}

export type SequentialThoughtInput = {
  thought: string
  thoughtNumber: number
  totalThoughts: number
  nextThoughtNeeded: boolean
  isRevision?: boolean
  revisesThought?: number
  branchFromThought?: number
  branchId?: string
  needsMoreThoughts?: boolean
}

export type SequentialThoughtResult = {
  thoughtNumber: number
  totalThoughts: number
  nextThoughtNeeded: boolean
  branches: string[]
  thoughtHistoryLength: number
}

const DEFAULT_SESSION_ID = 'default'

/** MCP-compatible sequential thinking step recorder. */
export function recordSequentialThought(
  input: SequentialThoughtInput,
  sessionId: string = DEFAULT_SESSION_ID,
): SequentialThoughtResult {
  let session = sessions.get(sessionId)
  if (!session) {
    session = {
      id: sessionId,
      problem: 'MCP sequential thinking',
      steps: [],
      createdAt: Date.now(),
    }
    sessions.set(sessionId, session)
  }

  addThought(sessionId, input.thought, {
    revisionOf: input.isRevision ? input.revisesThought : undefined,
    branchFrom: input.branchFromThought,
  })

  const branches = new Set<string>()
  for (const step of session.steps) {
    if (step.branchFrom) branches.add(String(step.branchFrom))
    if (input.branchId) branches.add(input.branchId)
  }

  const totalThoughts = input.needsMoreThoughts
    ? Math.max(input.totalThoughts, input.thoughtNumber + 1)
    : input.totalThoughts

  if (!input.nextThoughtNeeded && !session.conclusion) {
    session.conclusion = input.thought
  }

  return {
    thoughtNumber: input.thoughtNumber,
    totalThoughts,
    nextThoughtNeeded: input.nextThoughtNeeded,
    branches: [...branches],
    thoughtHistoryLength: session.steps.length,
  }
}

export function formatSequentialThoughtToolResult(
  input: SequentialThoughtInput,
  sessionId: string = DEFAULT_SESSION_ID,
): string {
  const result = recordSequentialThought(input, sessionId)
  const session = sessions.get(sessionId)
  const lines = [
    `Thought ${result.thoughtNumber}/${result.totalThoughts}`,
    input.thought,
  ]
  if (input.isRevision && input.revisesThought) {
    lines.push(`(revises thought ${input.revisesThought})`)
  }
  if (input.branchFromThought) {
    lines.push(`(branch from thought ${input.branchFromThought})`)
  }
  if (session && result.thoughtHistoryLength > 0) {
    lines.push('', formatThinkingForPrompt(session))
  }
  return lines.join('\n')
}
