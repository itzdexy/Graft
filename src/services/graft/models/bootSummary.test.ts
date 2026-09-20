import { describe, expect, test } from 'bun:test'
import { describeBootTarget } from './bootSummary.js'

describe('describeBootTarget', () => {
  test('never throws, whatever the config looks like', () => {
    // This renders on the launch screen before AppStateProvider exists; a
    // throw here would replace startup with a stack trace.
    expect(() => describeBootTarget()).not.toThrow()
  })

  test('returns either null or a labelled target', () => {
    const target = describeBootTarget()
    if (target === null) return
    expect(typeof target.providerLabel).toBe('string')
    expect(target.providerLabel.length).toBeGreaterThan(0)
    expect(typeof target.modelLabel).toBe('string')
  })
})
