/**
 * Submit guard for the prompt composer.
 *
 * Previously `onSubmit` refused to submit whenever the suggestion list was
 * non-empty, which silently swallowed Enter (no feedback, no submission)
 * whenever a stale or unselected list was open. Enter must only defer to the
 * typeahead when a row is actively highlighted — otherwise the message
 * submits exactly once.
 */
export function shouldDeferSubmitToSuggestions(options: {
  suggestionCount: number
  selectedSuggestion: number
  isSubmittingSlashCommand: boolean
  allDirectories: boolean
}): boolean {
  if (options.isSubmittingSlashCommand) return false
  if (options.suggestionCount === 0) return false
  // Directory completions use Tab, never Enter.
  if (options.allDirectories) return false
  return (
    options.selectedSuggestion >= 0 &&
    options.selectedSuggestion < options.suggestionCount
  )
}
