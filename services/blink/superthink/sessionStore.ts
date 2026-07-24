import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SuperthinkAnswer, SuperthinkPlan } from './types.js'
import { goalSlug, sessionDir } from './researchStore.js'

export type SuperthinkSessionPhase =
  | 'research'
  | 'clarify'
  | 'ready'
  | 'building'
  | 'done'

export type SuperthinkSessionMeta = {
  goal: string
  slug: string
  phase: SuperthinkSessionPhase
  updatedAt: number
}

const ACTIVE_FILE = 'active.json'

function activePath(cwd: string): string {
  return join(cwd, '.blink', 'superthink', ACTIVE_FILE)
}

function planPath(cwd: string, goal: string): string {
  return join(sessionDir(cwd, goal), 'plan.json')
}

function answersPath(cwd: string, goal: string): string {
  return join(sessionDir(cwd, goal), 'answers.json')
}

function designPath(cwd: string, goal: string): string {
  return join(sessionDir(cwd, goal), 'design.md')
}

export function setActiveSuperthinkGoal(cwd: string, goal: string): void {
  const dir = join(cwd, '.blink', 'superthink')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(
    activePath(cwd),
    JSON.stringify(
      { goal: goal.trim(), slug: goalSlug(goal), updatedAt: Date.now() },
      null,
      2,
    ),
    'utf8',
  )
}

export function getActiveSuperthinkGoal(cwd: string): string | null {
  const path = activePath(cwd)
  if (!existsSync(path)) return null
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!parsed || typeof parsed !== 'object') return null
    const goal = (parsed as { goal?: unknown }).goal
    return typeof goal === 'string' && goal.trim() ? goal.trim() : null
  } catch {
    return null
  }
}

export function hasResearchBrief(cwd: string, goal: string): boolean {
  return existsSync(join(sessionDir(cwd, goal), 'research.md'))
}

export function hasApprovedPlan(cwd: string, goal: string): boolean {
  return existsSync(planPath(cwd, goal))
}

export function loadApprovedPlan(
  cwd: string,
  goal: string,
): { plan: SuperthinkPlan; answers: SuperthinkAnswer[] } | null {
  const pPath = planPath(cwd, goal)
  const aPath = answersPath(cwd, goal)
  if (!existsSync(pPath)) return null
  try {
    const plan = JSON.parse(readFileSync(pPath, 'utf8')) as SuperthinkPlan
    const answers = existsSync(aPath)
      ? (JSON.parse(readFileSync(aPath, 'utf8')) as SuperthinkAnswer[])
      : []
    if (!plan?.summary || !Array.isArray(plan.steps)) return null
    return { plan, answers }
  } catch {
    return null
  }
}

export function saveApprovedSession(
  cwd: string,
  goal: string,
  answers: SuperthinkAnswer[],
  plan: SuperthinkPlan,
  designMarkdown: string,
): void {
  const dir = sessionDir(cwd, goal)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(answersPath(cwd, goal), JSON.stringify(answers, null, 2), 'utf8')
  writeFileSync(planPath(cwd, goal), JSON.stringify(plan, null, 2), 'utf8')
  writeFileSync(designPath(cwd, goal), designMarkdown.trim() + '\n', 'utf8')
  setActiveSuperthinkGoal(cwd, goal)
}

export function deriveSessionPhase(cwd: string, goal: string): SuperthinkSessionPhase {
  if (!hasResearchBrief(cwd, goal)) return 'research'
  if (!hasApprovedPlan(cwd, goal)) return 'clarify'
  if (existsSync(join(sessionDir(cwd, goal), 'building.json'))) return 'building'
  return 'ready'
}

export function markSuperthinkBuilding(cwd: string, goal: string): void {
  const dir = sessionDir(cwd, goal)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'building.json'),
    JSON.stringify({ startedAt: Date.now() }, null, 2),
    'utf8',
  )
}

/** List superthink sessions under this project, newest activity first. */
export function listSuperthinkSessions(cwd: string): SuperthinkSessionMeta[] {
  const root = join(cwd, '.blink', 'superthink')
  if (!existsSync(root)) return []
  const sessions: SuperthinkSessionMeta[] = []
  for (const name of readdirSync(root)) {
    if (name === ACTIVE_FILE) continue
    const dir = join(root, name)
    try {
      if (!statSync(dir).isDirectory()) continue
    } catch {
      continue
    }
    const research = join(dir, 'research.md')
    if (!existsSync(research)) continue
    let goal = readSessionGoal(cwd, name) ?? name.replace(/-/g, ' ')
    const design = join(dir, 'design.md')
    if (!readSessionGoal(cwd, name) && existsSync(design)) {
      const firstLine = readFileSync(design, 'utf8').split('\n').find(l => l.startsWith('goal:'))
      if (firstLine) goal = firstLine.replace(/^goal:\s*/i, '').trim() || goal
    }
    const mtime = Math.max(
      statSync(research).mtimeMs,
      existsSync(join(dir, 'plan.json')) ? statSync(join(dir, 'plan.json')).mtimeMs : 0,
    )
    sessions.push({
      goal,
      slug: name,
      phase: deriveSessionPhase(cwd, goal),
      updatedAt: mtime,
    })
  }
  return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
}

function goalRecordPath(cwd: string, goal: string): string {
  return join(sessionDir(cwd, goal), 'goal.txt')
}

export function recordSessionGoal(cwd: string, goal: string): void {
  const dir = sessionDir(cwd, goal)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(goalRecordPath(cwd, goal), goal.trim() + '\n', 'utf8')
}

export function readSessionGoal(cwd: string, slug: string): string | null {
  const path = join(cwd, '.blink', 'superthink', slug, 'goal.txt')
  if (!existsSync(path)) return null
  try {
    const t = readFileSync(path, 'utf8').trim()
    return t || null
  } catch {
    return null
  }
}
