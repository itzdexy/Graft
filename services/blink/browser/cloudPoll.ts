/** HTTP statuses worth retrying during Browser Use session polling. */
export function isTransientBrowserPollStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504
}

export const BROWSER_POLL_INTERVAL_MS = 3_000
export const BROWSER_POLL_DEADLINE_MS = 10 * 60 * 1000
export const BROWSER_POLL_MAX_TRANSIENT_RETRIES = 3

export function browserPollBackoffMs(attempt: number): number {
  const capped = Math.min(Math.max(attempt, 0), 4)
  return BROWSER_POLL_INTERVAL_MS * (capped + 1)
}