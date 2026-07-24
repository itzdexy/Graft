import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const PLANS_DIR = '.blink/ecosystem/plans'

export type PlanVersion = {
  id: string
  goal: string
  createdAt: string
  summary: string
  body: string
}

function plansRoot(cwd: string): string {
  return join(cwd, PLANS_DIR)
}

function slug(goal: string): string {
  return (
    goal
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'plan'
  )
}

export function savePlanVersion(
  cwd: string,
  goal: string,
  body: string,
  summary?: string,
): PlanVersion {
  const root = join(plansRoot(cwd), slug(goal))
  mkdirSync(root, { recursive: true })
  const id = `v-${Date.now()}`
  const plan: PlanVersion = {
    id,
    goal: goal.trim(),
    createdAt: new Date().toISOString(),
    summary: summary?.trim() || body.trim().slice(0, 200),
    body: body.trim(),
  }
  writeFileSync(join(root, `${id}.json`), JSON.stringify(plan, null, 2), 'utf8')
  writeFileSync(join(root, 'latest.txt'), id, 'utf8')
  return plan
}

export function listPlanVersions(cwd: string, goal: string): PlanVersion[] {
  const root = join(plansRoot(cwd), slug(goal))
  if (!existsSync(root)) return []
  const files = readdirSync(root).filter(f => f.endsWith('.json'))
  const plans: PlanVersion[] = []
  for (const f of files) {
    try {
      const raw = readFileSync(join(root, f), 'utf8')
      plans.push(JSON.parse(raw) as PlanVersion)
    } catch {
      // skip corrupt
    }
  }
  return plans.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function formatPlanVersionList(cwd: string, goal: string): string {
  const plans = listPlanVersions(cwd, goal)
  if (!plans.length) {
    return `No plan versions for: ${goal.trim() || '(no goal)'}\nSave with \`/plan\` then \`/ecosystem plan save <goal>\`.`
  }
  return [
    `# Plan versions (Plandex-style branches)`,
    '',
    `Goal: ${goal.trim()}`,
    '',
    ...plans.map(
      (p, i) =>
        `${i + 1}. \`${p.id}\` — ${p.createdAt.slice(0, 16)} — ${p.summary}`,
    ),
  ].join('\n')
}
