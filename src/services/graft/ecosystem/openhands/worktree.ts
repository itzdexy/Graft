import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const WORKTREES_DIR = '.graft/ecosystem/worktrees'

export type WorktreePlan = {
  id: string
  name: string
  branch: string
  path: string
  createdAt: string
  commands: string[]
}

function worktreesRoot(cwd: string): string {
  return join(cwd, WORKTREES_DIR)
}

function slug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'issue'
  )
}

export function buildWorktreePlan(cwd: string, name: string): WorktreePlan {
  const id = `wt-${Date.now()}`
  const branch = `openhands/${slug(name)}`
  const relPath = join('.graft', 'worktrees', slug(name))
  const absPath = join(cwd, relPath)
  return {
    id,
    name: name.trim(),
    branch,
    path: absPath,
    createdAt: new Date().toISOString(),
    commands: [
      `git worktree add -b ${branch} "${relPath.replace(/\\/g, '/')}"`,
      `cd "${relPath.replace(/\\/g, '/')}"`,
    ],
  }
}

export function saveWorktreePlan(cwd: string, plan: WorktreePlan): void {
  const root = worktreesRoot(cwd)
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, `${plan.id}.json`), JSON.stringify(plan, null, 2), 'utf8')
}

export function listWorktreePlans(cwd: string): WorktreePlan[] {
  const root = worktreesRoot(cwd)
  if (!existsSync(root)) return []
  const out: WorktreePlan[] = []
  for (const f of readdirSync(root).filter(x => x.endsWith('.json'))) {
    try {
      out.push(JSON.parse(readFileSync(join(root, f), 'utf8')) as WorktreePlan)
    } catch {
      // skip
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function formatWorktreeList(cwd: string): string {
  const plans = listWorktreePlans(cwd)
  if (!plans.length) {
    return 'No OpenHands worktree plans saved.\n\nCreate: `/worktree new <name>`'
  }
  return [
    '# OpenHands worktree plans',
    '',
    ...plans.map(
      p =>
        `- \`${p.id}\` — **${p.name}** — branch \`${p.branch}\` — \`${p.path}\``,
    ),
    '',
    'Recreate: `/worktree git <id-prefix>`',
  ].join('\n')
}

export function formatWorktreePlan(plan: WorktreePlan): string {
  return [
    '# OpenHands isolated worktree',
    '',
    `Name: **${plan.name}**`,
    `Branch: \`${plan.branch}\``,
    `Path: \`${plan.path}\``,
    '',
    'Commands (review before running):',
    ...plan.commands.map(c => `- \`${c}\``),
    '',
    'Use for issue fixes without touching the main working tree.',
  ].join('\n')
}
