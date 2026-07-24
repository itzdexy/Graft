import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { join, resolve } from 'node:path'
import { getBlinkHome } from '../../../scripts/blink-home.js'

const TOGGLE_REL = join('.blink', 'superthink', 'toggle.json')

const listeners = new Set<() => void>()

export function subscribeSuperthinkState(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function notifySuperthinkState(): void {
  for (const listener of listeners) {
    listener()
  }
}

function normalizeCwd(cwd: string): string {
  try {
    return realpathSync.native(resolve(cwd)).normalize('NFC')
  } catch {
    return resolve(cwd).normalize('NFC')
  }
}

function projectTogglePath(cwd: string): string {
  return join(normalizeCwd(cwd), TOGGLE_REL)
}

function legacySlug(cwd: string): string {
  return cwd.replace(/[^a-zA-Z0-9]+/g, '_').slice(-80) || 'default'
}

function legacyTogglePaths(cwd: string): string[] {
  const home = join(getBlinkHome(), '.blink')
  const variants = new Set([cwd, normalizeCwd(cwd), resolve(cwd)])
  return [...variants].map(c => join(home, `superthink-${legacySlug(c)}.json`))
}

function readEnabledAt(path: string): boolean | null {
  if (!existsSync(path)) return null
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
    if (!parsed || typeof parsed !== 'object') return null
    return (parsed as { enabled?: unknown }).enabled === true
  } catch {
    return null
  }
}

function writeProjectToggle(cwd: string, enabled: boolean): void {
  const root = normalizeCwd(cwd)
  const dir = join(root, '.blink', 'superthink')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'toggle.json'),
    JSON.stringify({ enabled, updatedAt: Date.now() }, null, 2),
    { mode: 0o600 },
  )
}

function migrateLegacyToggle(cwd: string): boolean | null {
  for (const legacyPath of legacyTogglePaths(cwd)) {
    const enabled = readEnabledAt(legacyPath)
    if (enabled === null) continue
    writeProjectToggle(cwd, enabled)
    return enabled
  }
  return null
}

export function isSuperthinkEnabled(cwd: string): boolean {
  const project = readEnabledAt(projectTogglePath(cwd))
  if (project !== null) return project
  const migrated = migrateLegacyToggle(cwd)
  return migrated === true
}

export function setSuperthinkEnabled(cwd: string, enabled: boolean): void {
  writeProjectToggle(cwd, enabled)
  notifySuperthinkState()
}
