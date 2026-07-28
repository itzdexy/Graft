import { describe, expect, test } from 'bun:test'
import {
  getSpinnerVerbs,
  pickSpinnerVerb,
  SPINNER_VERBS,
} from './spinnerVerbs.js'

describe('spinnerVerbs', () => {
  test('includes Tovyring and tungtungtungshaur', () => {
    expect(SPINNER_VERBS).toContain('Tovyring')
    expect(SPINNER_VERBS).toContain('tungtungtungshaur')
    expect(SPINNER_VERBS).not.toContain('Clauding')
  })

  test('accurate spinner is on by default', async () => {
    const { isTovyrAccurateSpinnerEnabled } = await import('./spinnerVerbs.js')
    delete process.env.TOVYR_ACCURATE_SPINNER
    expect(isTovyrAccurateSpinnerEnabled()).toBe(true)
    process.env.TOVYR_ACCURATE_SPINNER = '0'
    expect(isTovyrAccurateSpinnerEnabled()).toBe(false)
    delete process.env.TOVYR_ACCURATE_SPINNER
  })

  test('pickSpinnerVerb returns a known verb', () => {
    const verb = pickSpinnerVerb()
    expect(getSpinnerVerbs()).toContain(verb)
  })
})
