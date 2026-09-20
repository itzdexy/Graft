import { describe, expect, test } from 'bun:test'
import { resolveResetFocusValue } from './use-select-navigation.js'

describe('resolveResetFocusValue', () => {
  test('keeps the live cursor when the options list is rebuilt', () => {
    // The provider picker rebuilds `options` on every search keystroke while
    // passing a constant defaultFocusValue (the active provider). Re-applying
    // it here is what stole focus from the search field.
    expect(
      resolveResetFocusValue({
        focusValue: 'anthropic',
        lastFocusValue: 'anthropic',
        currentFocusedValue: '__search__',
        initialFocusValue: undefined,
      }),
    ).toBe('__search__')
  })

  test('honors focusValue when the parent changes it', () => {
    expect(
      resolveResetFocusValue({
        focusValue: 'openai',
        lastFocusValue: 'anthropic',
        currentFocusedValue: '__search__',
        initialFocusValue: undefined,
      }),
    ).toBe('openai')
  })

  test('honors focusValue on the first render, when there is no last value', () => {
    expect(
      resolveResetFocusValue({
        focusValue: 'anthropic',
        lastFocusValue: undefined,
        currentFocusedValue: undefined,
        initialFocusValue: undefined,
      }),
    ).toBe('anthropic')
  })

  test('falls back to the current cursor when no focusValue is given', () => {
    expect(
      resolveResetFocusValue({
        focusValue: undefined,
        lastFocusValue: undefined,
        currentFocusedValue: 'groq',
        initialFocusValue: 'anthropic',
      }),
    ).toBe('groq')
  })

  test('falls back to initialFocusValue when nothing is focused yet', () => {
    expect(
      resolveResetFocusValue({
        focusValue: undefined,
        lastFocusValue: undefined,
        currentFocusedValue: undefined,
        initialFocusValue: 'anthropic',
      }),
    ).toBe('anthropic')
  })

  test('returns undefined when there is nothing to focus', () => {
    expect(
      resolveResetFocusValue({
        focusValue: undefined,
        lastFocusValue: undefined,
        currentFocusedValue: undefined,
        initialFocusValue: undefined,
      }),
    ).toBeUndefined()
  })

  test('a parent clearing focusValue does not yank the cursor', () => {
    expect(
      resolveResetFocusValue({
        focusValue: undefined,
        lastFocusValue: 'anthropic',
        currentFocusedValue: 'groq',
        initialFocusValue: 'anthropic',
      }),
    ).toBe('groq')
  })
})
