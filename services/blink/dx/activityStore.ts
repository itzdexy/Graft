import type { ToolActivityEntry } from './types.js'

const MAX_ENTRIES = 50
const store = new Map<string, ToolActivityEntry[]>()
let revision = 0
const listeners = new Set<() => void>()

function slug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]+/g, '_').slice(-80) || 'default'
}

function notifyListeners(): void {
  revision += 1
  for (const listener of listeners) listener()
}

export function getToolActivityRevision(): number {
  return revision
}

export function subscribeToolActivity(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function recordToolActivity(
  cwd: string,
  entry: Omit<ToolActivityEntry, 'at'>,
): void {
  const key = slug(cwd)
  const list = store.get(key) ?? []
  list.push({ ...entry, at: Date.now() })
  while (list.length > MAX_ENTRIES) list.shift()
  store.set(key, list)
  notifyListeners()
}

export function getRecentToolActivity(
  cwd: string,
  limit = 12,
): ToolActivityEntry[] {
  const list = store.get(slug(cwd)) ?? []
  return list.slice(-limit)
}

export function clearToolActivity(cwd: string): void {
  store.delete(slug(cwd))
  notifyListeners()
}

/** Test helper */
export function _resetToolActivityStore(): void {
  store.clear()
  revision = 0
  listeners.clear()
}
