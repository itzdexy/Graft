export function buildContinueConfigFragment(projectName: string): string {
  return [
    '# Continue-compatible fragment (reference — Blink is the runtime)',
    `name: ${projectName}`,
    'rules:',
    '  - Run tests after substantive edits',
    '  - Prefer repo map context for large changes',
    'slashCommands:',
    '  - name: verify',
    '    description: Run test/lint/build via Blink /verify',
    '  - name: superthink',
    '    description: Research → plan → build workflow',
  ].join('\n')
}

export function formatContinueDevHelp(): string {
  return [
    '# Continue.dev patterns',
    '',
    'Open coding agent — config fragments and synced slash rules.',
    '',
    '## Commands',
    '- `/ecosystem config continue` — preview config.yaml fragment',
    '- `/ecosystem config continue write` — write fragment to project',
    '- `/ecosystem config continue rules` — mirror AGENTS.md → `.continue/rules/blink.md`',
    '',
    '## Skill',
    '`/skill ecosystem-continue` — session rules for Continue-style discipline.',
  ].join('\n')
}
