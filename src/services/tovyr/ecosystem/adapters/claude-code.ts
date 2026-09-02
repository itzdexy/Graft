export const TOVYR_CODE_BASELINE_NOTE = [
  'Tovyr baseline includes slash commands, skills, MCP, subagents,',
  'plan/code modes, compaction, and plugin ecosystem.',
  'Use /guide for the full Tovyr command cheat sheet.',
].join(' ')

export function formatClaudeCodeHelp(): string {
  return [
    '# Tovyr native capabilities',
    '',
    TOVYR_CODE_BASELINE_NOTE,
    '',
    '## Native features',
    '- `/skills` * `/mcp` - plugins, skills, Model Context Protocol',
    '- `/plan` * `/code` * `/ask` * `/bypass` - permission / workflow modes',
    '- `/agent` - forked subagents for parallel work',
    '- `/branch` - conversation fork (experiments)',
    '- `/compact` * `/hooks` - session hygiene and automation',
    '- `/guide` - full command cheat sheet',
  ].join('\n')
}
