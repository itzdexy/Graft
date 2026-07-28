import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CRUSH_FILE = '.tovyr/ecosystem/crush.json'

const listeners = new Set<() => void>()

export function subscribeCrushState(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notifyCrushState(): void {
  for (const listener of listeners) {
    listener()
  }
}

function crushPath(cwd: string): string {
  return join(cwd, CRUSH_FILE)
}

export function isCrushModeEnabled(cwd: string): boolean {
  const path = crushPath(cwd)
  if (!existsSync(path)) return false
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    return (
      !!parsed &&
      typeof parsed === 'object' &&
      (parsed as { enabled?: unknown }).enabled === true
    )
  } catch {
    return false
  }
}

export function setCrushModeEnabled(cwd: string, enabled: boolean): void {
  const path = crushPath(cwd)
  const dir = join(cwd, '.tovyr/ecosystem')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(
    path,
    JSON.stringify({ enabled, updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  )
  notifyCrushState()
}

export const CRUSH_COMPACT_PROMPT = [
  'Crush-style TUI output: bullet progress lines, no walls of text.',
  'Lead with status (done / next / blocked). Max 6 lines unless user asks for detail.',
  'Use `→` for next actions. Skip tool narration and repeated context.',
].join(' ')
