import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { discoverProjectContextFiles } from '../../context/agentsMd.js'

const RULES_DIR = '.continue/rules'

export function continueRulesPath(cwd: string): string {
  return join(cwd, RULES_DIR, 'blink.md')
}

function pickRulesSource(cwd: string): { path: string; content: string } | null {
  const files = discoverProjectContextFiles(cwd)
  const preferred = files.find(f => f.path.endsWith('AGENTS.md'))
  if (preferred) return preferred
  const blink = files.find(
    f => f.path.endsWith('BLINKCODE.md') || f.path.endsWith('blink.md'),
  )
  if (blink) return blink
  return null
}

/** Sync project context into Continue-compatible rules markdown. */
export function syncContinueRules(cwd: string): {
  path: string
  created: boolean
  source: string
} {
  const dir = join(cwd, RULES_DIR)
  const path = continueRulesPath(cwd)
  const source = pickRulesSource(cwd)
  const body = source
    ? [
        '# Blink / Continue rules',
        '',
        `Synced from \`${source.path}\`.`,
        '',
        source.content,
      ].join('\n')
    : [
        '# Blink / Continue rules',
        '',
        'No AGENTS.md found — add one with `/agents-md init` then re-sync.',
        '',
        '- Run `/verify` after substantive edits',
        '- Use `/repo graph` before large refactors',
        '- Capture risky diffs with `/sandbox-diff capture`',
      ].join('\n')

  mkdirSync(dir, { recursive: true })
  const existed = existsSync(path)
  writeFileSync(path, body + '\n', 'utf8')
  return {
    path,
    created: !existed,
    source: source?.path ?? '(default template)',
  }
}
