export const GRAFT_CODE_BASELINE_NOTE = [
  'Graft baseline includes slash commands, skills, MCP, subagents,',
  'plan/code modes, compaction, and plugin ecosystem.',
  'Use /guide for the full Graft command cheat sheet.',
].join(' ')

export function formatClaudeCodeHelp(): string {
  return [
    '# Graft native capabilities',
    '',
    GRAFT_CODE_BASELINE_NOTE,
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
