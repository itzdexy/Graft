export const AIDER_SEARCH_MISS_PREFIX = 'AIDER_SEARCH_MISS:'

export function isAiderSearchMissMessage(text: string): boolean {
  return (
    text.includes(AIDER_SEARCH_MISS_PREFIX) ||
    text.includes('SEARCH text not found') ||
    text.includes('No SEARCH/REPLACE blocks applied') ||
    text.includes('did not match and were skipped')
  )
}

export function formatAiderRetryFeedback(failures: string[]): string {
  return [
    `${AIDER_SEARCH_MISS_PREFIX} One or more SEARCH blocks did not match the file.`,
    '',
    ...failures.map(f => `- ${f}`),
    '',
    'Re-read the file with Read, then re-emit Edit with corrected SEARCH blocks.',
    'Use the exact whitespace from the file — do not paraphrase the SEARCH section.',
  ].join('\n')
}

/**
 * Feedback for a *partial* apply: some SEARCH blocks matched and were saved,
 * but others did not. Unlike a total miss, the matched edits are already on
 * disk, so the model must re-emit ONLY the unmatched blocks — re-sending the
 * applied ones would fail (their SEARCH text no longer exists in the file).
 */
export function formatAiderPartialApply(
  filePath: string,
  failures: string[],
): string {
  return [
    `Edited ${filePath}, but ${failures.length} SEARCH block(s) did not match and were skipped:`,
    '',
    ...failures.map(f => `- ${f}`),
    '',
    'The matched blocks were saved. Re-read the file with Read, then re-emit Edit',
    'with ONLY the unmatched SEARCH blocks above — using the exact whitespace from',
    'the file. Do not re-send blocks that already applied.',
  ].join('\n')
}

export const MAX_AIDER_RETRY_ROUNDS = 3

/** True when FileEditTool (or a prior retry) already formatted edit-recovery text. */
export function isAiderFormattedRetryMessage(text: string): boolean {
  return (
    text.includes(AIDER_SEARCH_MISS_PREFIX) ||
    text.includes('did not match and were skipped') ||
    text.includes('Re-read the file with Read, then re-emit Edit')
  )
}

/**
 * Build the meta user message for the aider retry loop in query.ts.
 * FileEditTool already throws fully formatted feedback on total miss; avoid
 * double-wrapping that (or partial-apply messages) in another bullet list.
 */
export function buildAiderRetryUserMessage(toolErrorContent: string): string {
  if (isAiderFormattedRetryMessage(toolErrorContent)) {
    return toolErrorContent
  }
  return formatAiderRetryFeedback([toolErrorContent])
}
