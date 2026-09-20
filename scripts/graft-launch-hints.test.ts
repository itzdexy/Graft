import { describe, expect, test } from 'bun:test'
import { shouldSkipHomeDirectoryCheck } from './graft-launch-hints.js'

describe('graft launch hints', () => {
  test('shouldSkipHomeDirectoryCheck allows maintenance commands from home', () => {
    expect(shouldSkipHomeDirectoryCheck(['doctor'])).toBe(true)
    expect(shouldSkipHomeDirectoryCheck(['config'])).toBe(true)
    expect(shouldSkipHomeDirectoryCheck(['models'])).toBe(true)
    expect(shouldSkipHomeDirectoryCheck(['provider', 'list'])).toBe(true)
    expect(shouldSkipHomeDirectoryCheck(['ask', 'what is git?'])).toBe(true)
    expect(shouldSkipHomeDirectoryCheck(['-p', 'summarize'])).toBe(true)
  })

  test('shouldSkipHomeDirectoryCheck blocks bare interactive launch', () => {
    expect(shouldSkipHomeDirectoryCheck([])).toBe(false)
    expect(shouldSkipHomeDirectoryCheck(['--full'])).toBe(false)
  })
})
