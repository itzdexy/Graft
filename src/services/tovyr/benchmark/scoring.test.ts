import { describe, expect, test } from 'bun:test'
import { summarizeResults } from './scoring.js'
import type { BenchCaseResult } from './types.js'
import { casesForSuite } from './suites.js'

describe('benchmark scoring', () => {
  test('summarizeResults computes percent', () => {
    const results: BenchCaseResult[] = [
      {
        id: 'a',
        name: 'A',
        category: 'safety',
        mode: 'offline',
        passed: true,
        score: 100,
        weight: 2,
        durationMs: 10,
      },
      {
        id: 'b',
        name: 'B',
        category: 'safety',
        mode: 'offline',
        passed: false,
        score: 0,
        weight: 1,
        durationMs: 5,
      },
    ]
    const s = summarizeResults(results, false)
    expect(s.passed).toBe(1)
    expect(s.failed).toBe(1)
    expect(s.scorePercent).toBeCloseTo(66.7, 0)
  })
})

describe('benchmark suites', () => {
  test('smoke suite is small', () => {
    const cases = casesForSuite('smoke', false)
    expect(cases.length).toBeGreaterThanOrEqual(3)
    expect(cases.every(c => c.mode === 'offline')).toBe(true)
  })

  test('full suite adds live when requested', () => {
    const offline = casesForSuite('full', false)
    const withLive = casesForSuite('full', true)
    expect(withLive.length).toBeGreaterThan(offline.length)
  })
})
