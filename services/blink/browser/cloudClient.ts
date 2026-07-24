import {
  BROWSER_POLL_DEADLINE_MS,
  BROWSER_POLL_INTERVAL_MS,
  BROWSER_POLL_MAX_TRANSIENT_RETRIES,
  browserPollBackoffMs,
  isTransientBrowserPollStatus,
} from './cloudPoll.js'
import {
  extractCreatedSessionId,
  interpretSessionPoll,
  tryImmediateCreateResult,
  type BrowserSessionBody,
} from './sessionParsing.js'

const API_BASE = 'https://api.browser-use.com/api/v3'

function getApiKey(): string | undefined {
  return process.env.BROWSER_USE_API_KEY?.trim() || undefined
}

async function pollSession(
  sessionId: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<string> {
  const deadline = Date.now() + BROWSER_POLL_DEADLINE_MS
  let transientRetries = 0
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error('Browser task aborted')
    const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
      headers: { 'X-Browser-Use-API-Key': apiKey },
      signal,
    })
    if (!res.ok) {
      const text = await res.text()
      if (
        isTransientBrowserPollStatus(res.status) &&
        transientRetries < BROWSER_POLL_MAX_TRANSIENT_RETRIES
      ) {
        transientRetries += 1
        await new Promise(r =>
          setTimeout(r, browserPollBackoffMs(transientRetries)),
        )
        continue
      }
      throw new Error(
        `Browser Use poll failed (${res.status}): ${text.slice(0, 500)}`,
      )
    }
    transientRetries = 0
    const body = (await res.json()) as BrowserSessionBody
    const outcome = interpretSessionPoll(body)
    if (outcome.kind === 'success') {
      return outcome.output
    }
    if (outcome.kind === 'failed') {
      throw new Error(outcome.error)
    }
    await new Promise(r => setTimeout(r, BROWSER_POLL_INTERVAL_MS))
  }
  throw new Error('Browser Use task timed out after 10 minutes')
}

/** Run a natural-language browser task via Browser Use Cloud. */
export async function runBrowserUseTask(
  task: string,
  signal?: AbortSignal,
): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error(
      'BROWSER_USE_API_KEY is not set. Add it to your environment (never commit it).',
    )
  }

  const create = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: {
      'X-Browser-Use-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ task }),
    signal,
  })

  if (!create.ok) {
    const text = await create.text()
    throw new Error(`Browser Use create failed (${create.status}): ${text.slice(0, 500)}`)
  }

  const created = (await create.json()) as BrowserSessionBody
  const immediate = tryImmediateCreateResult(created)
  if (immediate) {
    return immediate
  }
  const sessionId = extractCreatedSessionId(created)
  if (!sessionId) {
    throw new Error('Browser Use API returned no session id')
  }

  return pollSession(sessionId, apiKey, signal)
}

export function isBrowserUseConfigured(): boolean {
  return Boolean(getApiKey())
}
