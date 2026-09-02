/** Codex-inspired approval policy labels (maps to Tovyr permission modes). */
export type CodexApprovalMode = 'suggest' | 'auto-edit' | 'full-auto'

export const CODEX_APPROVAL_MODES: Record<
  CodexApprovalMode,
  { label: string; tovyrMode: string; summary: string }
> = {
  suggest: {
    label: 'Suggest',
    tovyrMode: 'ask',
    summary: 'Confirm each tool use (default Tovyr).',
  },
  'auto-edit': {
    label: 'Auto-edit',
    tovyrMode: 'code',
    summary: 'Auto-approve file edits; confirm shell.',
  },
  'full-auto': {
    label: 'Full-auto',
    tovyrMode: 'bypass',
    summary: 'Auto-approve edits and bash (use with care).',
  },
}

export function formatCodexApprovalHelp(): string {
  return Object.entries(CODEX_APPROVAL_MODES)
    .map(
      ([id, m]) =>
        `- **${m.label}** (\`${id}\`) → Tovyr \`/${m.tovyrMode}\` — ${m.summary}`,
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
