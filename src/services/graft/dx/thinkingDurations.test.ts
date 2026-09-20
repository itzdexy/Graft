import { beforeEach, describe, expect, test } from 'bun:test'
import {
  _resetThinkingDurations,
  lookupThinkingDuration,
  recordThinkingDuration,
} from './thinkingDurations.js'
import { summarizeThinkingGist } from './thinkingHeader.js'

beforeEach(() => {
  _resetThinkingDurations()
})

describe('thinking duration store', () => {
  test('round-trips a recorded duration', () => {
    recordThinkingDuration('weighing the options', 16_300)
    expect(lookupThinkingDuration('weighing the options')).toBe(16_300)
  })

  test('is insensitive to surrounding whitespace', () => {
    recordThinkingDuration('  padded thought  ', 900)
    expect(lookupThinkingDuration('padded thought')).toBe(900)
  })

  test('returns undefined for unseen content', () => {
    expect(lookupThinkingDuration('never recorded')).toBeUndefined()
  })

  test('ignores empty content and non-positive durations', () => {
    recordThinkingDuration('   ', 500)
    recordThinkingDuration('real', 0)
    recordThinkingDuration('real', -5)
    expect(lookupThinkingDuration('   ')).toBeUndefined()
    expect(lookupThinkingDuration('real')).toBeUndefined()
  })

  test('distinguishes blocks that share a prefix but differ in length', () => {
    const a = `${'a'.repeat(200)}TAIL-ONE`
    const b = `${'a'.repeat(200)}TAIL-TWO-LONGER`
    recordThinkingDuration(a, 100)
    recordThinkingDuration(b, 200)
    expect(lookupThinkingDuration(a)).toBe(100)
    expect(lookupThinkingDuration(b)).toBe(200)
  })

  test('evicts oldest entries past the cap without losing recent ones', () => {
    for (let i = 0; i < 260; i++) {
      recordThinkingDuration(`thought number ${i}`, i + 1)
    }
    expect(lookupThinkingDuration('thought number 0')).toBeUndefined()
    expect(lookupThinkingDuration('thought number 259')).toBe(260)
  })
})

describe('summarizeThinkingGist', () => {
  test('takes the first substantive line', () => {
    expect(summarizeThinkingGist('First line here.\nSecond line.')).toBe(
      'First line here.',
    )
  })

  test('skips leading blank lines', () => {
    expect(summarizeThinkingGist('\n\n  \nActual content')).toBe(
      'Actual content',
    )
  })

  test('strips markdown headers, bullets and emphasis', () => {
    expect(summarizeThinkingGist('## Plan')).toBe('Plan')
    expect(summarizeThinkingGist('- do the thing')).toBe('do the thing')
    expect(summarizeThinkingGist('1. numbered step')).toBe('numbered step')
    expect(summarizeThinkingGist('**bold** and `code`')).toBe('bold and code')
  })

  test('truncates past the width budget', () => {
    const gist = summarizeThinkingGist('y'.repeat(400))
    expect(gist.length).toBe(120)
    expect(gist.endsWith('…')).toBe(true)
  })

  test('returns empty when there is nothing to show', () => {
    expect(summarizeThinkingGist('   \n\n  ')).toBe('')
  })
})
