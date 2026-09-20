import { describe, expect, test } from 'bun:test'
import {
  AIDER_SEARCH_MISS_PREFIX,
  buildAiderRetryUserMessage,
  formatAiderPartialApply,
  formatAiderRetryFeedback,
  isAiderFormattedRetryMessage,
  isAiderSearchMissMessage,
  MAX_AIDER_RETRY_ROUNDS,
} from './aiderRetry.js'

describe('aiderRetry', () => {
  test('detects search miss messages', () => {
    expect(isAiderSearchMissMessage(`${AIDER_SEARCH_MISS_PREFIX} foo`)).toBe(true)
    expect(isAiderSearchMissMessage('SEARCH text not found in file')).toBe(true)
    expect(isAiderSearchMissMessage('No SEARCH/REPLACE blocks applied')).toBe(true)
    expect(
      isAiderSearchMissMessage(
        formatAiderPartialApply('a.ts', ['Block 2: SEARCH text not found']),
      ),
    ).toBe(true)
    expect(isAiderSearchMissMessage('permission denied')).toBe(false)
  })

  test('buildAiderRetryUserMessage does not double-wrap formatted feedback', () => {
    const formatted = formatAiderRetryFeedback(['Block 1: not found'])
    expect(buildAiderRetryUserMessage(formatted)).toBe(formatted)
    expect(isAiderFormattedRetryMessage(formatted)).toBe(true)

    const partial = formatAiderPartialApply('src/x.ts', [
      'Block 2: SEARCH text not found in file',
    ])
    expect(buildAiderRetryUserMessage(partial)).toBe(partial)

    const raw = 'some unexpected tool error'
    const wrapped = buildAiderRetryUserMessage(raw)
    expect(wrapped).toContain(AIDER_SEARCH_MISS_PREFIX)
    expect(wrapped).toContain(raw)
    expect(wrapped).not.toBe(raw)
  })

  test('formats retry feedback', () => {
    const text = formatAiderRetryFeedback(['block 1 failed'])
    expect(text).toContain(AIDER_SEARCH_MISS_PREFIX)
    expect(text).toContain('Re-read the file')
    expect(text).toContain('block 1 failed')
  })

  test('max rounds is 3', () => {
    expect(MAX_AIDER_RETRY_ROUNDS).toBe(3)
  })

  test('partial-apply feedback names the file, lists failures, and instructs retry of only failed blocks', () => {
    const text = formatAiderPartialApply('src/foo.ts', [
      'Block 2: SEARCH text not found in file',
    ])
    expect(text).toContain('src/foo.ts')
    expect(text).toContain('Block 2: SEARCH text not found in file')
    expect(text).toContain('ONLY the unmatched SEARCH blocks')
    expect(text).toContain('were saved')
    // It must be recognizable as a search-miss so detection utilities agree.
    expect(isAiderSearchMissMessage(text)).toBe(true)
    // Reports the correct count.
    expect(text).toContain('1 SEARCH block(s)')
  })

  test('isAiderFormattedRetryMessage recognizes partial-apply text', () => {
    const partial = formatAiderPartialApply('x.ts', ['Block 1: miss'])
    expect(isAiderFormattedRetryMessage(partial)).toBe(true)
    expect(isAiderFormattedRetryMessage('random error')).toBe(false)
  })

  test('partial-apply feedback reflects multiple failures', () => {
    const text = formatAiderPartialApply('a.ts', [
      'Block 1: SEARCH text not found in file',
      'Block 3: SEARCH text not found in file',
    ])
    expect(text).toContain('2 SEARCH block(s)')
    expect(text).toContain('Block 1:')
    expect(text).toContain('Block 3:')
  })
})
