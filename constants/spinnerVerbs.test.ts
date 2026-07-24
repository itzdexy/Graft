import { describe, expect, test } from 'bun:test'
import {
  getSpinnerVerbs,
  pickSpinnerVerb,
  SPINNER_VERBS,
} from './spinnerVerbs.js'

describe('spinnerVerbs', () => {
  test('includes Blinking and tungtungtungshaur', () => {
    expect(SPINNER_VERBS).toContain('Blinking')
    expect(SPINNER_VERBS).toContain('tungtungtungshaur')
    expect(SPINNER_VERBS).not.toContain('Clauding')
  })

  test('accurate spinner is on by default', async () => {
    const { isBlinkAccurateSpinnerEnabled } = await import('./spinnerVerbs.js')
    delete process.env.BLINK_ACCURATE_SPINNER
    expect(isBlinkAccurateSpinnerEnabled()).toBe(true)
    process.env.BLINK_ACCURATE_SPINNER = '0'
    expect(isBlinkAccurateSpinnerEnabled()).toBe(false)
    delete process.env.BLINK_ACCURATE_SPINNER
  })

  test('pickSpinnerVerb returns a known verb', () => {
    const verb = pickSpinnerVerb()
    expect(getSpinnerVerbs()).toContain(verb)
  })
})
