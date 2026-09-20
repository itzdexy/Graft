import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectProjectScripts } from '../../verify/projectScripts.js'

/** Aider-style post-edit lint/test suggestion for the model. */
export function suggestLintAfterEdit(cwd: string): string | null {
  const scripts = detectProjectScripts(cwd)
  const parts: string[] = []
  for (const check of scripts.checks) {
    parts.push(
      `${check.kind}: \`${[check.command, ...check.args].join(' ')}\``,
    )
  }
  if (!parts.length) return null
  return [
    'Aider-style: after edits, run project checks when scripts exist:',
    ...parts.map(p => `- ${p}`),
    'Or use `/verify` / `/agent autofix`.',
  ].join('\n')
}

export function readPackageScripts(cwd: string): Record<string, string> | undefined {
  const path = join(cwd, 'package.json')
  if (!existsSync(path)) return undefined
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf8')) as { scripts?: Record<string, string> }
    return pkg.scripts
  } catch {
    return undefined
  }
}
