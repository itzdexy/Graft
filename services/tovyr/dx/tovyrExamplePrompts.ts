export type TovyrExamplePrompt = {
  label: string
  hint: string
}

/** Suggested first messages — hint is what gets sent to the model. */
export const TOVYR_EXAMPLE_PROMPTS: TovyrExamplePrompt[] = [
  {
    label: 'Explain this project',
    hint: 'Explain what this repo does and how it is organized',
  },
  {
    label: 'Find bugs',
    hint: 'Scan for likely bugs and risky patterns',
  },
  {
    label: 'Improve the UI',
    hint: 'Suggest concrete UI improvements for this app',
  },
  {
    label: 'Write tests',
    hint: 'Add tests for the most important modules',
  },
  {
    label: 'Refactor safely',
    hint: 'Refactor the messiest module with minimal risk',
  },
  {
    label: 'Run project scan',
    hint: 'Summarize package manager, scripts, and git status',
  },
]

const LABEL_HINT_SEPARATORS = [' - ', ' — ', ' – ', ': '] as const

/** Common UTF-8 em dash mojibake on Windows terminals. */
const MOJIBAKE_SEPARATORS = [' ┌Çö ', ' ÔÇö ', ' â€" ', ' â€" '] as const

function matchesExamplePaste(
  trimmed: string,
  label: string,
  hint: string,
): boolean {
  for (const sep of [...LABEL_HINT_SEPARATORS, ...MOJIBAKE_SEPARATORS]) {
    if (trimmed === `${label}${sep}${hint}`) return true
  }
  return false
}

/**
 * If the user copy-pastes a welcome-screen line (label + separator + hint),
 * send only the hint. Handles mojibake from UTF-8 em dashes on Windows terminals.
 */
export function resolveTovyrExamplePromptInput(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return text

  for (const example of TOVYR_EXAMPLE_PROMPTS) {
    if (trimmed === example.hint) return example.hint
    if (matchesExamplePaste(trimmed, example.label, example.hint)) {
      return example.hint
    }
  }

  return text
}
