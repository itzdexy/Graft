import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { getTovyrHome } from '../../../scripts/tovyr-home.js'
import { getCwd } from '../../../utils/cwd.js'
import {
  detectProjectScripts,
  formatProjectScripts,
} from '../verify/projectScripts.js'

const CONTEXT_FILENAMES = [
  'AGENTS.md',
  'TOVYRCODE.md',
  'tovyr.md',
  'CLAUDE.md',
] as const

export type ProjectContextFile = {
  path: string
  content: string
}

function readIfExists(absPath: string): string | null {
  if (!existsSync(absPath)) return null
  try {
    const text = readFileSync(absPath, 'utf8').trim()
    return text.length ? text : null
  } catch {
    return null
  }
}

export function findGitRoot(startDir: string): string | null {
  let cur = resolve(startDir)
  while (true) {
    if (existsSync(join(cur, '.git'))) return cur
    const parent = resolve(cur, '..')
    if (parent === cur) return null
    cur = parent
  }
}

/** Collect global + ancestor project context files (root → cwd). */
export function discoverProjectContextFiles(
  cwd: string,
  repoRoot?: string | null,
): ProjectContextFile[] {
  const root = repoRoot ?? findGitRoot(cwd) ?? cwd
  const found: ProjectContextFile[] = []

  const globalPath = join(getTovyrHome(), 'AGENTS.md')
  const global = readIfExists(globalPath)
  if (global) found.push({ path: globalPath, content: global })

  const chain: string[] = []
  let cur = resolve(cwd)
  const resolvedRoot = resolve(root)
  while (true) {
    chain.unshift(cur)
    if (cur === resolvedRoot) break
    const parent = resolve(cur, '..')
    if (parent === cur) break
    cur = parent
  }

  for (const dir of chain) {
    for (const name of CONTEXT_FILENAMES) {
      const path = join(dir, name)
      const content = readIfExists(path)
      if (content) found.push({ path, content })
    }
  }

  const seen = new Set<string>()
  return found.filter(f => {
    if (seen.has(f.path)) return false
    seen.add(f.path)
    return true
  })
}

/** System prompt section from AGENTS.md / TOVYRCODE.md hierarchy. */
export function loadProjectContextSection(cwd = getCwd()): string | null {
  const files = discoverProjectContextFiles(cwd)
  if (!files.length) return null

  const body = files
    .map(f => `## ${f.path}\n\n${f.content}`)
    .join('\n\n')

  return [
    '# Project context (AGENTS.md / TOVYRCODE.md)',
    '',
    'Follow these repo-specific instructions. They override generic habits when they conflict.',
    '',
    body,
  ].join('\n')
}

/** Starter AGENTS.md for `/init` or manual creation. */
export function generateAgentsMdTemplate(cwd: string): string {
  const scripts = detectProjectScripts(cwd)
  const verifySection = formatProjectScripts(scripts)

  return [
    '# AGENTS.md',
    '',
    'Guidance for Tovyr when working in this repository.',
    '',
    '## Commands',
    '',
    verifySection,
    '',
    '## Architecture',
    '',
    '(Describe high-level layout: main entrypoints, where tests live, and non-obvious boundaries.)',
    '',
    '## Conventions',
    '',
    '- Keep diffs minimal; match existing style.',
    '- Run verify commands after substantive edits when possible.',
    '- Never commit secrets or API keys.',
    '',
    '## Gotchas',
    '',
    '(Required env vars, flaky tests, deployment quirks — only what Tovyr would get wrong without reading the whole repo.)',
  ].join('\n')
}
