import { describe, expect, test } from 'bun:test'
import { shouldDeferSubmitToSuggestions } from './submitGuard.js'

describe('shouldDeferSubmitToSuggestions', () => {
  test('submits plain text when no suggestions are showing', () => {
    expect(
      shouldDeferSubmitToSuggestions({
        suggestionCount: 0,
        selectedSuggestion: -1,
        isSubmittingSlashCommand: false,
        allDirectories: false,
      }),
    ).toBe(false)
  })

  test('submits when a stale list is open but nothing is highlighted', () => {
    // Regression: an unselected list used to swallow Enter silently.
    expect(
      shouldDeferSubmitToSuggestions({
        suggestionCount: 5,
        selectedSuggestion: -1,
        isSubmittingSlashCommand: false,
        allDirectories: false,
      }),
    ).toBe(false)
  })

  test('defers to the typeahead only while a row is highlighted', () => {
    expect(
      shouldDeferSubmitToSuggestions({
        suggestionCount: 5,
        selectedSuggestion: 2,
        isSubmittingSlashCommand: false,
        allDirectories: false,
      }),
    ).toBe(true)
  })

  test('slash-command execution from the typeahead always submits', () => {
    expect(
      shouldDeferSubmitToSuggestions({
        suggestionCount: 3,
        selectedSuggestion: 0,
        isSubmittingSlashCommand: true,
        allDirectories: false,
      }),
    ).toBe(false)
  })

  test('directory-only lists never block Enter (Tab completes)', () => {
    expect(
      shouldDeferSubmitToSuggestions({
        suggestionCount: 3,
        selectedSuggestion: 0,
        isSubmittingSlashCommand: false,
        allDirectories: true,
      }),
    ).toBe(false)
  })

  test('out-of-range selection is treated as no selection', () => {
    expect(
      shouldDeferSubmitToSuggestions({
        suggestionCount: 3,
        selectedSuggestion: 7,
        isSubmittingSlashCommand: false,
        allDirectories: false,
      }),
    ).toBe(false)
  })
})
