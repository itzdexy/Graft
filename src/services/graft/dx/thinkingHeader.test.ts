import { describe, expect, test } from 'bun:test'
import {
  formatThinkingDuration,
  formatThinkingHeader,
  summarizeLiveThinking,
} from './thinkingHeader.js'

describe('formatThinkingDuration', () => {
  test('one decimal below a minute', () => {
    expect(formatThinkingDuration(16_300)).toBe('16.3s')
    expect(formatThinkingDuration(1_000)).toBe('1.0s')
  })

  test('sub-second thoughts still show a measurement', () => {
    // "0s" reads as broken; "0.4s" reads as measured.
    expect(formatThinkingDuration(400)).toBe('0.4s')
  })

  test('minutes and padded seconds past 60s', () => {
    expect(formatThinkingDuration(64_000)).toBe('1m 04s')
    expect(formatThinkingDuration(600_000)).toBe('10m 00s')
  })

  test('negative input is clamped rather than rendered', () => {
    expect(formatThinkingDuration(-5)).toBe('0.0s')
  })
})

describe('formatThinkingHeader', () => {
  test('a finished block uses a disclosure chevron and its duration', () => {
    expect(formatThinkingHeader({ state: 'collapsed', elapsedMs: 16_300 })).toEqual(
      { marker: '›', label: 'Thought: 16.3s' },
    )
  })

  test('expanding flips the marker but keeps the label', () => {
    expect(formatThinkingHeader({ state: 'expanded', elapsedMs: 16_300 })).toEqual(
      { marker: '⌄', label: 'Thought: 16.3s' },
    )
  })

  test('streaming reads as present tense', () => {
    expect(formatThinkingHeader({ state: 'streaming' })).toEqual({
      marker: '◐',
      label: 'Thinking',
    })
  })

  test('an unmeasured block omits the number rather than inventing 0.0s', () => {
    expect(formatThinkingHeader({ state: 'collapsed' })).toEqual({
      marker: '›',
      label: 'Thought',
    })
  })
})

test('live thinking follows new reasoning and bounds long lines', () => {
  expect(summarizeLiveThinking('First idea\nChecking the actual error')).toBe('Checking the actual error')
  expect(summarizeLiveThinking('First idea\n')).toBe('First idea')
  const latest = summarizeLiveThinking('Earlier reasoning '.repeat(40) + 'latest evidence')
  expect(latest.endsWith('latest evidence')).toBe(true)
  expect(latest.length).toBeLessThanOrEqual(120)
  expect(summarizeLiveThinking('   ')).toBe('')
})
