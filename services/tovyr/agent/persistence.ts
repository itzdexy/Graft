/**
 * Tovyr Agent Persistence
 *
 * Manages agent session and working memory storage in ~/.tovyr/agent/.
 * Includes structural validation to prevent crashes from corrupt or outdated session files.
 *
 * @module services/tovyr/agent/persistence
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from 'fs'
import { join, normalize, sep } from 'path'
import { getTovyrHome } from '../../../scripts/tovyr-home.js'
import { writeJsonAtomic } from '../fsSafe.js'
import type { AgentSession } from './types.js'

function agentDir(): string {
  return join(getTovyrHome(), 'agent')
}

function cwdSlug(cwd: string): string {
  // Normalize path separators to forward slashes for consistent hashing
  // Windows: C:\Users\project → C:/Users/project
  const normalized = normalize(cwd).replace(/\\/g, '/')
  // Remove drive letter on Windows (C:/ → /) for consistent slugs
  const withoutDrive = normalized.replace(/^[A-Za-z]:/, '')
  // Replace non-alphanumeric with underscores, take last 80 chars
  return withoutDrive.replace(/[^a-zA-Z0-9]+/g, '_').slice(-80) || 'default'
}

export function agentSessionPath(cwd: string): string {
  return join(agentDir(), `session-${cwdSlug(cwd)}.json`)
}

export function workingMemoryPath(cwd: string): string {
  return join(agentDir(), `working-${cwdSlug(cwd)}.json`)
}

/**
 * Minimal structural guard: a corrupt or old-format session file can parse to
 * valid JSON that is NOT a usable AgentSession (e.g. missing `steps`). Returning
 * it would crash the loop on `session.steps.length` / `session.steps[i]`, so we
 * treat anything missing the core fields as "no session".
 */
function isUsableSession(value: unknown): value is AgentSession {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return (
    typeof s.cwd === 'string' &&
    Array.isArray(s.steps) &&
    typeof s.phase === 'string' &&
    !!s.goal &&
    typeof s.goal === 'object'
  )
}

export function loadAgentSession(cwd: string): AgentSession | null {
  const path = agentSessionPath(cwd)
  if (!existsSync(path)) return null
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return isUsableSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveAgentSession(session: AgentSession): void {
  const dir = agentDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeJsonAtomic(
    agentSessionPath(session.cwd),
    { ...session, updatedAt: Date.now() },
    { mode: 0o600 },
  )
}

export function clearAgentSession(cwd: string): boolean {
  const path = agentSessionPath(cwd)
  if (!existsSync(path)) return false
  unlinkSync(path)
  return true
}

export function listAgentSessions(): { cwd: string; path: string; updatedAt: number }[] {
  const dir = agentDir()
  if (!existsSync(dir)) return []
  const out: { cwd: string; path: string; updatedAt: number }[] = []
  for (const name of readdirSync(dir)) {
    if (!name.startsWith('session-') || !name.endsWith('.json')) continue
    const path = join(dir, name)
    try {
      const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
      if (!isUsableSession(parsed)) continue
      const updatedAt =
        typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0
      out.push({ cwd: parsed.cwd, path, updatedAt })
    } catch {
      // skip corrupt files
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt)
}
