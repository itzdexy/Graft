/** Normalized Browser Use Cloud session payload (subset of API response). */
export type BrowserSessionBody = {
  id?: string
  status?: string
  output?: string
  result?: string
  error?: string
}

export type SessionPollOutcome =
  | { kind: 'pending' }
  | { kind: 'success'; output: string }
  | { kind: 'failed'; error: string }

const SUCCESS_STATUSES = new Set(['completed', 'finished', 'done'])
const FAILURE_STATUSES = new Set(['failed', 'error'])

export function normalizeSessionStatus(status: string | undefined): string {
  return (status ?? '').trim().toLowerCase()
}

export function isSessionTerminalSuccess(status: string | undefined): boolean {
  return SUCCESS_STATUSES.has(normalizeSessionStatus(status))
}

export function isSessionTerminalFailure(status: string | undefined): boolean {
  return FAILURE_STATUSES.has(normalizeSessionStatus(status))
}

/** Prefer human-readable output fields; fall back to full JSON for debugging. */
export function extractSessionOutput(body: BrowserSessionBody): string {
  if (body.output != null && body.output !== '') {
    return body.output
  }
  if (body.result != null && body.result !== '') {
    return body.result
  }
  return JSON.stringify(body)
}

export function interpretSessionPoll(body: BrowserSessionBody): SessionPollOutcome {
  const status = normalizeSessionStatus(body.status)
  if (isSessionTerminalSuccess(status)) {
    return { kind: 'success', output: extractSessionOutput(body) }
  }
  if (isSessionTerminalFailure(status)) {
    return {
      kind: 'failed',
      error: body.error?.trim() || 'Browser Use task failed',
    }
  }
  return { kind: 'pending' }
}

export function extractCreatedSessionId(
  body: BrowserSessionBody,
): string | undefined {
  const id = body.id?.trim()
  return id || undefined
}

/** Immediate result when create returns output without a session id. */
export function tryImmediateCreateResult(
  body: BrowserSessionBody,
): string | undefined {
  if (body.id?.trim()) {
    return undefined
  }
  const output = body.output ?? body.result
  return output != null && output !== '' ? output : undefined
}