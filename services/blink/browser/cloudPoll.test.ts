import { describe, expect, test } from 'bun:test'
import {
  BROWSER_POLL_INTERVAL_MS,
  browserPollBackoffMs,
  isTransientBrowserPollStatus,
} from './cloudPoll.js'

describe('cloudPoll helpers', () => {
  test('transient statuses include rate limit and gateway errors', () => {
    expect(isTransientBrowserPollStatus(429)).toBe(true)
    expect(isTransientBrowserPollStatus(502)).toBe(true)
    expect(isTransientBrowserPollStatus(503)).toBe(true)
    expect(isTransientBrowserPollStatus(504)).toBe(true)
    expect(isTransientBrowserPollStatus(500)).toBe(false)
    expect(isTransientBrowserPollStatus(404)).toBe(false)
  })

  test('backoff grows with attempt count', () => {
    expect(browserPollBackoffMs(1)).toBe(BROWSER_POLL_INTERVAL_MS * 2)
    expect(browserPollBackoffMs(2)).toBe(BROWSER_POLL_INTERVAL_MS * 3)
    expect(browserPollBackoffMs(99)).toBe(BROWSER_POLL_INTERVAL_MS * 5)
  })
})