/**
 * Semantic command history (Phase 10).
 * Stores recent user prompts under ~/.tovyr/command-history.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getTovyrHome } from '../../../../scripts/tovyr-home.js'

export type CommandHistoryEntry = {
  text: string
  cwd: string
  at: number
}

const MAX_ENTRIES = 500
const HISTORY_PATH = join(getTovyrHome(), 'command-history.json')

function readHistory(): CommandHistoryEntry[] {
  if (!existsSync(HISTORY_PATH)) return []
  try {
    const data = JSON.parse(readFileSync(HISTORY_PATH, 'utf8')) as CommandHistoryEntry[]
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function writeHistory(entries: CommandHistoryEntry[]): void {
  const dir = getTovyrHome()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(HISTORY_PATH, JSON.stringify(entries.slice(-MAX_ENTRIES)), {
    mode: 0o600,
  })
}

export function recordCommandHistory(text: string, cwd: string): void {
  const trimmed = text.trim()
  if (!trimmed || trimmed.startsWith('/')) return
  const entries = readHistory()
  entries.push({ text: trimmed, cwd, at: Date.now() })
  writeHistory(entries)
}

export function searchCommandHistory(
  query: string,
  cwd?: string,
  limit = 10,
): CommandHistoryEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return readHistory()
    .filter(e => (!cwd || e.cwd === cwd) && e.text.toLowerCase().includes(q))
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
}

export function formatCommandHistoryHelp(): string {
  return [
    '# Tovyr command history',
    '',
    `Recent natural-language goals stored at \`${HISTORY_PATH}\`.`,
    'Use searchCommandHistory() for fuzzy recall (Phase 10 foundation).',
    'Session resume via `/session` remains the primary transcript restore.',
  ].join('\n')
}
