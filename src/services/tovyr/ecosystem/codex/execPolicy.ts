import { join } from 'node:path'
import { getCwd } from '../../../../utils/cwd.js'
import { suggestCodexAgentsMdSection } from '../adapters/codex.js'

/** Codex-style execpolicy.md for tool/shell approval documentation. */
export function generateExecPolicyMd(cwd: string): string {
  const name = cwd.split(/[/\\]/).pop() ?? 'project'
  return [
    '# execpolicy.md',
    '',
    `Project: ${name}`,
    '',
    '## Defaults',
    '- File edits: allowed in workspace',
    '- Network: WebFetch/WebSearch allowed',
    '- Destructive shell: require user confirmation unless `/bypass`',
    '',
    '## Deny patterns',
    '- `rm -rf /`',
    '- Publishing secrets to git',
    '',
    '## Tovyr modes',
    '- `/mode ask` — confirm tools (Codex suggest)',
    '- `/mode code` — auto-edit',
    '- `/mode bypass` — full-auto (dangerous)',
    '',
    '## AGENTS.md',
    suggestCodexAgentsMdSection(name),
  ].join('\n')
}

export function execPolicyPath(cwd = getCwd()): string {
  return join(cwd, 'execpolicy.md')
}
