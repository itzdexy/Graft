import { describe, expect, test } from 'bun:test'
import {
  getSpinnerVerbs,
  pickSpinnerVerb,
  SPINNER_VERBS,
} from './spinnerVerbs.js'

describe('spinnerVerbs', () => {
  test('includes Grafting and tungtungtungshaur', () => {
    expect(SPINNER_VERBS).toContain('Grafting')
    expect(SPINNER_VERBS).toContain('tungtungtungshaur')
    expect(SPINNER_VERBS).not.toContain('Clauding')
  })

  test('literal phase labels are the default; playful verbs are opt-in', async () => {
    const { isGraftAccurateSpinnerEnabled } = await import('./spinnerVerbs.js')
    // Default flipped: a resampled random verb carries no information, and it
    // masks a stall — "Julienning · 155s" instead of "Waiting for first token".
    delete process.env.GRAFT_ACCURATE_SPINNER
    expect(isGraftAccurateSpinnerEnabled()).toBe(true)
    // Both env overrides still work in both directions.
    process.env.GRAFT_ACCURATE_SPINNER = '1'
    expect(isGraftAccurateSpinnerEnabled()).toBe(true)
    process.env.GRAFT_ACCURATE_SPINNER = '0'
    expect(isGraftAccurateSpinnerEnabled()).toBe(false)
    delete process.env.GRAFT_ACCURATE_SPINNER
  })

  test('ships the playful verbs the spinner is meant to show', () => {
    for (const verb of ['Rizzing', 'Cooking', 'Vibing', 'Simmering']) {
      expect(SPINNER_VERBS).toContain(verb)
    }
  })

  test('pickSpinnerVerb returns a known verb', () => {
    const verb = pickSpinnerVerb()
    expect(getSpinnerVerbs()).toContain(verb)
  })
})
