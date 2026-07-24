/** Codex-inspired approval policy labels (maps to Blink permission modes). */
export type CodexApprovalMode = 'suggest' | 'auto-edit' | 'full-auto'

export const CODEX_APPROVAL_MODES: Record<
  CodexApprovalMode,
  { label: string; blinkMode: string; summary: string }
> = {
  suggest: {
    label: 'Suggest',
    blinkMode: 'ask',
    summary: 'Confirm each tool use (default Blink).',
  },
  'auto-edit': {
    label: 'Auto-edit',
    blinkMode: 'code',
    summary: 'Auto-approve file edits; confirm shell.',
  },
  'full-auto': {
    label: 'Full-auto',
    blinkMode: 'bypass',
    summary: 'Auto-approve edits and bash (use with care).',
  },
}

export function formatCodexApprovalHelp(): string {
  return Object.entries(CODEX_APPROVAL_MODES)
    .map(
      ([id, m]) =>
        `- **${m.label}** (\`${id}\`) → Blink \`/${m.blinkMode}\` — ${m.summary}`,
    )
    .join('\n')
}

export function suggestCodexAgentsMdSection(projectName: string): string {
  return [
    `# AGENTS.md — ${projectName}`,
    '',
    '## Build & test',
    '- Install: `(fill in)`',
    '- Test: `(fill in)`',
    '- Lint: `(fill in)`',
    '',
    '## Conventions',
    '- Match existing style in touched files.',
    '- Prefer small, reviewable diffs.',
    '',
    '## Agent notes',
    '- Run `/verify` after substantive edits.',
    '- Use `/repo analyze` for large refactors.',
  ].join('\n')
}
