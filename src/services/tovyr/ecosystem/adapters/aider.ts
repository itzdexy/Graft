/** Aider-inspired commit message from a short diff stat line. */
export function aiderCommitMessageFromSummary(summary: string): string {
  const clean = summary.replace(/\s+/g, ' ').trim().slice(0, 180)
  if (!clean) return 'apply edits'
  return clean
}

export function aiderLintTestHint(packageJsonScripts?: Record<string, string>): string {
  const hints: string[] = []
  if (packageJsonScripts?.test) hints.push('npm test')
  if (packageJsonScripts?.lint) hints.push('npm run lint')
  if (packageJsonScripts?.build) hints.push('npm run build')
  return hints.length ? hints.join(' · ') : 'npm test (if present)'
}

export const AIDER_EDIT_FORMAT_REMINDER = [
  'Use Aider SEARCH/REPLACE blocks when patching existing files:',
  '<<<<<<< SEARCH',
  'old lines',
  '=======',
  'new lines',
  '>>>>>>> REPLACE',
].join('\n')

export function formatAiderHelp(): string {
  return [
    '# Aider patterns',
    '',
    'Pair-programming agent: repo map, SEARCH/REPLACE edits, git commits, lint hints.',
    '',
    '## Commands',
    '- `/aider format` — SEARCH/REPLACE block reminder',
    '- `/aider map` — cached repo map',
    '- `/aider lint` — project test/lint scripts',
    '- `/expansion tasks` — scan TOVYR/TODO comment triggers',
    '- `/repo graph` — ranked symbol map (tree-sitter heuristics)',
    '- `/git-commit` — commit with `tovyrcode:` prefix',
    '- `/verify` — auto-verify after edits (lint hook when scripts exist)',
  ].join('\n')
}
