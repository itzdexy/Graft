/** Crush-inspired keyboard hints (shown in ? shortcuts). */
export const CRUSH_STYLE_SHORTCUTS = [
  { keys: 'Ctrl+C', action: 'Cancel current turn' },
  { keys: 'Ctrl+L', action: 'Clear screen (terminal)' },
  { keys: '↑ / ↓', action: 'History in prompt' },
  { keys: '/plan', action: 'Plan before coding (Plandex/Superthink)' },
  { keys: '/recipe', action: 'Goose-style multi-step workflow' },
  { keys: '/experiment', action: 'OpenCode-style experiment fork' },
  { keys: '/crush on', action: 'Compact TUI output mode' },
  { keys: '/aider', action: 'Aider SEARCH/REPLACE + repo map' },
  { keys: '/sandbox-diff', action: 'Review AI diffs before apply' },
] as const

export function formatCrushShortcuts(): string {
  return CRUSH_STYLE_SHORTCUTS.map(s => `- **${s.keys}** — ${s.action}`).join('\n')
}

export function formatCrushHelp(): string {
  return [
    '# Crush patterns',
    '',
    'Charm terminal agent — keyboard-first, compact TUI output.',
    '',
    '## Commands',
    '- `/crush on` · `/crush off` — compact bullet replies (footer badge)',
    '- `/crush shortcuts` — keybinding cheat sheet',
    '',
    '## Shortcuts',
    formatCrushShortcuts(),
  ].join('\n')
}
