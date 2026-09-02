import {
  formatWarpBlocksForAgent,
  parseWarpCommandBlocks,
} from '../adapters/warp.js'

export type WarpRunPlan = {
  blocks: string[]
  destructive: boolean
}

const DESTRUCTIVE_RE =
  /\b(rm\s+-rf|drop\s+table|truncate|mkfs|dd\s+if=|git\s+push\s+--force|git\s+reset\s+--hard)\b/i

export function planWarpBlocks(paste: string): WarpRunPlan {
  const blocks = parseWarpCommandBlocks(paste)
  const destructive = blocks.some(b => DESTRUCTIVE_RE.test(b))
  return { blocks, destructive }
}

export function formatWarpRunPreview(plan: WarpRunPlan): string {
  if (!plan.blocks.length) {
    return 'No command blocks detected. Paste multi-line shell with blank lines between steps.'
  }
  const warn = plan.destructive
    ? '\n\n⚠ **Destructive commands detected** — confirm each block before running.'
    : ''
  return [
    `# Warp blocks (${plan.blocks.length})`,
    '',
    formatWarpBlocksForAgent(plan.blocks),
    warn,
    '',
    'Run with `/warp run` (re-paste) or `/warp run --last` after a paste.',
  ].join('\n')
}

export function buildWarpRunPrompt(blocks: string[]): string {
  return [
    '# Warp-style command block runner',
    '',
    'Run each block **in order** via Bash. Stop on first failure.',
    'Confirm with the user before destructive commands.',
    '',
    formatWarpBlocksForAgent(blocks),
    '',
    'After each block, show exit code and concise output summary.',
  ].join('\n')
}
