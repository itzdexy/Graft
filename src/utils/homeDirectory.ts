import { existsSync } from 'fs'
import { homedir } from 'os'
import { join, resolve } from 'path'

const PROJECT_MARKERS = [
  '.git',
  'package.json',
  'pyproject.toml',
  'Cargo.toml',
  'go.mod',
  'pom.xml',
  'build.gradle',
  'build.gradle.kts',
  'Gemfile',
  'composer.json',
  'graft.md',
  'CLAUDE.md',
  'AGENTS.md',
] as const

/** True when `dir` is the user's home directory (case-insensitive on Windows). */
export function isHomeDirectory(dir?: string): boolean {
  const cwd = dir ?? process.cwd()
  const home = getHomeDirectory()
  if (!home) return false
  try {
    return resolve(cwd).toLowerCase() === resolve(home).toLowerCase()
  } catch {
    return false
  }
}

export function getHomeDirectory(): string | undefined {
  return process.env.USERPROFILE || process.env.HOME || homedir() || undefined
}

/** True when the folder looks like a project workspace (not just a personal home root). */
export function isLikelyProjectDirectory(dir?: string): boolean {
  const cwd = dir ?? process.cwd()
  try {
    const root = resolve(cwd)
    return PROJECT_MARKERS.some(marker => existsSync(join(root, marker)))
  } catch {
    return false
  }
}

/** Block interactive launch from home root unless it is clearly a project folder. */
export function shouldBlockHomeDirectory(dir?: string): boolean {
  if (process.env.GRAFT_ALLOW_HOME === '1') return false
  const cwd = dir ?? process.cwd()
  if (!isHomeDirectory(cwd)) return false
  if (isLikelyProjectDirectory(cwd)) return false
  return true
}
