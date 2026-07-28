import { describe, expect, test } from 'bun:test'
import {
  categoryForToolName,
  createToolLog,
  finishToolLog,
  formatToolLog,
  withToolRetry,
} from './framework.js'

describe('tool framework', () => {
  test('categoryForToolName maps bash to terminal', () => {
    expect(categoryForToolName('Bash')).toBe('terminal')
    expect(categoryForToolName('Read')).toBe('filesystem')
    expect(categoryForToolName('WebFetch')).toBe('browser')
  })

  test('withToolRetry succeeds on first attempt', async () => {
    let calls = 0
    const result = await withToolRetry(async () => {
      calls++
      return 42
    })
    expect(result).toBe(42)
    expect(calls).toBe(1)
  })

  test('withToolRetry retries on timeout-like errors', async () => {
    let calls = 0
    const result = await withToolRetry(
      async () => {
        calls++
        if (calls < 2) throw new Error('timeout')
        return 'ok'
      },
      { baseDelayMs: 1 },
    )
    expect(result).toBe('ok')
    expect(calls).toBe(2)
  })

  test('formatToolLog redacts secrets in error field', () => {
    const log = finishToolLog(
      createToolLog('Bash', 1, 'npm test'),
      false,
      'OPENAI_API_KEY=supersecretvalue123 failed',
    )
    const formatted = formatToolLog(log)
    expect(formatted).toContain('OPENAI_API_KEY=[REDACTED]')
    expect(formatted).not.toContain('supersecretvalue123')
    expect(formatted).toContain('input=npm test')
  })
})
