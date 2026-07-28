import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createOpencodeForkMeta,
  type OpencodeForkMeta,
} from '../adapters/opencode.js'

const FORKS_DIR = '.tovyr/ecosystem/forks'
const ACTIVE_FILE = 'active.json'

function forksRoot(cwd: string): string {
  return join(cwd, FORKS_DIR)
}

function forkPath(cwd: string, forkId: string): string {
  return join(forksRoot(cwd), `${forkId}.json`)
}

function slugBranch(label: string, forkId: string): string {
  const base =
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32) || 'experiment'
  return `experiment/${base}-${forkId.slice(0, 8)}`
}

export function saveExperimentFork(
  cwd: string,
  label: string,
  parentSessionId?: string,
): OpencodeForkMeta {
  const meta = createOpencodeForkMeta(label, parentSessionId)
  const root = forksRoot(cwd)
  mkdirSync(root, { recursive: true })
  writeFileSync(forkPath(cwd, meta.forkId), JSON.stringify(meta, null, 2), 'utf8')
  writeFileSync(
    join(root, ACTIVE_FILE),
    JSON.stringify({ forkId: meta.forkId, updatedAt: meta.createdAt }, null, 2),
    'utf8',
  )
  return meta
}

export function listExperimentForks(cwd: string): OpencodeForkMeta[] {
  const root = forksRoot(cwd)
  if (!existsSync(root)) return []
  const files = readdirSync(root).filter(f => f.endsWith('.json') && f !== ACTIVE_FILE)
  const forks: OpencodeForkMeta[] = []
  for (const f of files) {
    try {
      forks.push(JSON.parse(readFileSync(join(root, f), 'utf8')) as OpencodeForkMeta)
    } catch {
      // skip corrupt
    }
  }
  return forks.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getActiveExperimentFork(cwd: string): OpencodeForkMeta | null {
  const activePath = join(forksRoot(cwd), ACTIVE_FILE)
  if (!existsSync(activePath)) return null
  try {
    const { forkId } = JSON.parse(readFileSync(activePath, 'utf8')) as { forkId: string }
    const path = forkPath(cwd, forkId)
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8')) as OpencodeForkMeta
  } catch {
    return null
  }
}

export function setActiveExperimentFork(cwd: string, forkId: string): boolean {
  const path = forkPath(cwd, forkId)
  if (!existsSync(path)) return false
  const root = forksRoot(cwd)
  mkdirSync(root, { recursive: true })
  writeFileSync(
    join(root, ACTIVE_FILE),
    JSON.stringify({ forkId, updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  )
  return true
}

export function suggestExperimentGitBranch(meta: OpencodeForkMeta): string {
  return slugBranch(meta.label, meta.forkId)
}

export function formatExperimentForkList(cwd: string): string {
  const forks = listExperimentForks(cwd)
  const active = getActiveExperimentFork(cwd)
  if (!forks.length) {
    return 'No OpenCode-style experiment forks yet.\n\nCreate: `/experiment new <label>`'
  }
  return [
    '# Experiment forks (OpenCode-style)',
    '',
    ...forks.map(f => {
      const mark = active?.forkId === f.forkId ? ' **(active)**' : ''
      const branch = suggestExperimentGitBranch(f)
      return `- \`${f.forkId.slice(0, 8)}…\`${mark} — **${f.label}** — branch \`${branch}\` — ${f.createdAt.slice(0, 16)}`
    }),
    '',
    'Use `/experiment git` to create the git branch for the active fork.',
  ].join('\n')
}

export function formatExperimentStatus(cwd: string): string {
  const active = getActiveExperimentFork(cwd)
  if (!active) {
    return 'No active experiment fork.\n\nRun `/experiment new <label>` to start an isolated try.'
  }
  const branch = suggestExperimentGitBranch(active)
  return [
    '# Active experiment',
    '',
    `**${active.label}**`,
    `forkId: \`${active.forkId}\``,
    `suggested branch: \`${branch}\``,
    '',
    'Next: `/experiment git` — create git branch and work in the fork.',
    'Or `/branch` — fork the conversation at this point.',
  ].join('\n')
}
