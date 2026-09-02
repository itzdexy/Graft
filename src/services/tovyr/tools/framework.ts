/** Universal tool framework — permissions, retry, logging (incremental). */

import {
  isRetryableToolError,
  redactSecretsForToolLog,
} from './safety.js'

export type ToolCategory =
  | 'filesystem'
  | 'terminal'
  | 'git'
  | 'browser'
  | 'memory'
  | 'search'
  | 'code_analysis'
  | 'agent'

export type ToolPermission = 'allow' | 'ask' | 'deny'

export type ToolPolicy = {
  category: ToolCategory
  permission: ToolPermission
}

export type ToolExecutionLog = {
  tool: string
  category: ToolCategory
  startedAt: number
  endedAt?: number
  success?: boolean
  error?: string
  attempt: number
  /** Redacted input summary for debug logs (optional). */
  inputSummary?: string
}

const DEFAULT_POLICIES: ToolPolicy[] = [
  { category: 'filesystem', permission: 'ask' },
  { category: 'terminal', permission: 'ask' },
  { category: 'git', permission: 'ask' },
  { category: 'browser', permission: 'allow' },
  { category: 'memory', permission: 'allow' },
  { category: 'search', permission: 'allow' },
  { category: 'code_analysis', permission: 'allow' },
  { category: 'agent', permission: 'ask' },
]

export function getDefaultToolPolicies(): ToolPolicy[] {
  return DEFAULT_POLICIES.map(p => ({ ...p }))
}

export function categoryForToolName(name: string): ToolCategory {
  const n = name.toLowerCase()
  if (n.includes('bash') || n.includes('shell')) return 'terminal'
  if (n.includes('read') || n.includes('write') || n.includes('edit')) return 'filesystem'
  if (n.includes('grep') || n.includes('glob')) return 'search'
  if (n.includes('web') || n.includes('browser') || n.includes('fetch')) return 'browser'
  if (n.includes('agent') || n.includes('task')) return 'agent'
  if (n.includes('memory')) return 'memory'
  return 'code_analysis'
}

export type RetryOptions = {
  maxAttempts: number
  baseDelayMs: number
  shouldRetry: (error: unknown, attempt: number) => boolean
}

const DEFAULT_RETRY: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 500,
  shouldRetry: (error, attempt) => {
    if (attempt >= 3) return false
    return isRetryableToolError(error)
  },
}

export async function withToolRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY, ...options }
  let lastError: unknown
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (!opts.shouldRetry(error, attempt) || attempt === opts.maxAttempts) {
        throw error
      }
      await sleep(opts.baseDelayMs * attempt)
    }
  }
  throw lastError
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function createToolLog(
  tool: string,
  attempt = 1,
  inputSummary?: string,
): ToolExecutionLog {
  return {
    tool,
    category: categoryForToolName(tool),
    startedAt: Date.now(),
    attempt,
    inputSummary,
  }
}

export function finishToolLog(
  log: ToolExecutionLog,
  success: boolean,
  error?: string,
): ToolExecutionLog {
  return {
    ...log,
    endedAt: Date.now(),
    success,
    error,
  }
}

export function formatToolLog(log: ToolExecutionLog): string {
  const duration = log.endedAt ? log.endedAt - log.startedAt : 0
  const status = log.success === undefined ? 'running' : log.success ? 'ok' : 'fail'
  const inputPart = log.inputSummary ? ` input=${log.inputSummary}` : ''
  const errorPart = log.error
    ? ` — ${redactSecretsForToolLog(log.error)}`
    : ''
  return `[${log.category}] ${log.tool} attempt=${log.attempt} ${status} ${duration}ms${inputPart}${errorPart}`
}
