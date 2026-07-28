import { formatCodexApprovalHelp } from './adapters/codex.js'
import { formatClaudeCodeHelp } from './adapters/claude-code.js'
import { formatGeminiCliHelp } from './adapters/gemini-cli.js'
import { formatOpencodeHelp } from './adapters/opencode.js'
import { formatGooseHelp } from './adapters/goose.js'
import { formatOpenHandsHelp } from './adapters/openhands.js'
import { formatContinueDevHelp } from './adapters/continue-dev.js'
import { formatGptEngineerHelp } from './adapters/gpt-engineer.js'
import { formatAutoGptHelp } from './adapters/autogpt.js'
import { formatWarpHelp } from './adapters/warp.js'
import { formatOpenInterpreterHelp } from './adapters/openinterpreter.js'
import { formatAiderHelp } from './adapters/aider.js'
import { formatCrushHelp } from './adapters/crush.js'
import { PLANDEX_WORKFLOW_REMINDER } from './adapters/plandex.js'
import type { EcosystemUpstreamId } from './types.js'

/** Primary slash entry points per upstream (for coverage audit). */
export const UPSTREAM_ENTRY_POINTS: Record<EcosystemUpstreamId, string[]> = {
  'claude-code': ['/claude-code', '/skills', '/plan', '/code', '/mcp', '/agent'],
  codex: ['/codex', '/mode', '/agents-md', '/ecosystem execpolicy'],
  'gemini-cli': ['/gemini', '@ in prompt (auto-enrich)', '/mcp'],
  opencode: ['/opencode', '/experiment new', '/branch', '/repo analyze'],
  aider: ['/aider', '/repo graph', '/git-commit', '/verify'],
  goose: ['/goose', '/recipe list', '/recipe start', '/recipe next'],
  openhands: ['/resolve-issue', '/worktree new'],
  crush: ['/crush on', '/crush shortcuts'],
  plandex: ['/plandex', '/sandbox-diff', '/superthink', '/ecosystem plan'],
  continue: ['/continue-dev', '/ecosystem config continue rules'],
  'gpt-engineer': ['/improve', '/ecosystem template'],
  autogpt: ['/chain', '/reflect', '/agent start'],
  warp: ['/warp preview', '/warp run'],
  openinterpreter: ['/interpret'],
}

const HELP_BY_ID: Record<EcosystemUpstreamId, () => string> = {
  'claude-code': formatClaudeCodeHelp,
  codex: () =>
    [
      '# OpenAI Codex CLI patterns',
      '',
      '## Approval modes',
      formatCodexApprovalHelp(),
      '',
      '## Project context',
      '- `/agents-md init|show` — AGENTS.md template',
      '- `/ecosystem execpolicy write` — execpolicy.md for shell/tool policy',
      '',
      '## Verify',
      '- `/verify` after substantive edits',
    ].join('\n'),
  'gemini-cli': formatGeminiCliHelp,
  opencode: formatOpencodeHelp,
  aider: formatAiderHelp,
  goose: formatGooseHelp,
  openhands: formatOpenHandsHelp,
  crush: formatCrushHelp,
  plandex: () => `# Plandex patterns\n\n${PLANDEX_WORKFLOW_REMINDER}`,
  continue: formatContinueDevHelp,
  'gpt-engineer': formatGptEngineerHelp,
  autogpt: formatAutoGptHelp,
  warp: formatWarpHelp,
  openinterpreter: formatOpenInterpreterHelp,
}

export function getUpstreamHelp(id: EcosystemUpstreamId): string {
  return HELP_BY_ID[id]()
}

export function isUpstreamId(value: string): value is EcosystemUpstreamId {
  return value in HELP_BY_ID
}
