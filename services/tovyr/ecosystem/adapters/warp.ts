/** Warp-inspired: split pasted multi-line shell scripts into blocks. */
export function parseWarpCommandBlocks(paste: string): string[] {
  const lines = paste.split(/\r?\n/)
  const blocks: string[] = []
  let current: string[] = []

  const flush = () => {
    const joined = current.join('\n').trim()
    if (joined) blocks.push(joined)
    current = []
  }

  for (const line of lines) {
    if (line.trim() === '' && current.length > 0) {
      flush()
      continue
    }
    if (line.trim().startsWith('#') && current.length > 0) {
      flush()
    }
    current.push(line)
  }
  flush()
  return blocks
}

export function formatWarpBlocksForAgent(blocks: string[]): string {
  return blocks
    .map((b, i) => `### Block ${i + 1}\n\`\`\`bash\n${b}\n\`\`\``)
    .join('\n\n')
}

export function formatWarpHelp(): string {
  return [
    '# Warp patterns',
    '',
    'Block-based terminal — split multi-command pastes into steps.',
    '',
    '## Commands',
    '- `/warp preview <script>` — split paste into blocks (no run)',
    '- `/warp run <script>` — execute blocks in order via agent',
    '',
    '## Auto-enrich',
    'Multi-line shell pastes in prompts may be parsed as Warp blocks.',
  ].join('\n')
}
