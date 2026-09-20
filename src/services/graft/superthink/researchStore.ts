import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export function goalSlug(goal: string): string {
  return (
    goal
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || 'goal'
  )
}

export function sessionDir(cwd: string, goal: string): string {
  return join(cwd, '.graft', 'superthink', goalSlug(goal))
}

export function researchBriefPath(cwd: string, goal: string): string {
  return join(sessionDir(cwd, goal), 'research.md')
}

export function designDocPath(cwd: string, goal: string): string {
  return join(sessionDir(cwd, goal), 'design.md')
}

export function loadResearchBrief(cwd: string, goal: string): string | null {
  const path = researchBriefPath(cwd, goal)
  if (!existsSync(path)) return null
  try {
    const text = readFileSync(path, 'utf8').trim()
    return text.length ? text : null
  } catch {
    return null
  }
}

export function saveResearchBrief(cwd: string, goal: string, markdown: string): string {
  const dir = sessionDir(cwd, goal)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const path = researchBriefPath(cwd, goal)
  writeFileSync(path, markdown.trim() + '\n', 'utf8')
  return path
}

/** Pull bullet lines from a research brief to show as context on the questionnaire. */
export function summarizeResearchBrief(brief: string, maxLines = 12): string {
  const lines = brief
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'))
  return lines.slice(0, maxLines).join('\n')
}
