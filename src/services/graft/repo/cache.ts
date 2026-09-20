/**
 * Graft Repo Index Cache
 *
 * Caches repository index data in ~/.graft/repo-index/ with TTL and git-aware invalidation.
 * Cache files are named with SHA256 hash of cwd to prevent collisions.
 *
 * Cache invalidation strategy:
 * - TTL: 10 minutes (REPO_INDEX_CACHE_TTL_MS)
 * - Git HEAD: Invalidates when git commit changes (if in a git repo)
 * - CWD mismatch: Invalidates if cache is for a different directory
 *
 * @module services/graft/repo/cache
 */

import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getGraftHome } from '../../../../scripts/graft-home.js'
import type { RepoIndex } from './types.js'

export const REPO_INDEX_CACHE_TTL_MS = 10 * 60 * 1000

export function repoIndexCachePath(cwd: string): string {
  // Hash the full cwd so two projects whose sanitized suffix collides never
  // share a cache file (cwd is still validated on read).
  // Normalize Windows paths to ensure consistent hashing across platforms
  const normalizedCwd = cwd.replace(/\\/g, '/')
  const hash = createHash('sha256').update(normalizedCwd).digest('hex').slice(0, 16)
  const slug = normalizedCwd.replace(/[^a-zA-Z0-9]+/g, '_').slice(-40) || 'default'
  return join(getGraftHome(), 'repo-index', `${hash}_${slug}.json`)
}

/**
 * Best-effort synchronous HEAD for cache validation (no subprocess).
 * Returns a 40-char SHA when resolvable; null when not a git repo or unreadable.
 */
export function readGitHeadSync(cwd: string): string | null {
  const gitDir = join(cwd, '.git')
  if (!existsSync(gitDir)) return null
  try {
    const headRaw = readFileSync(join(gitDir, 'HEAD'), 'utf8').trim()
    if (!headRaw) return null
    if (headRaw.startsWith('ref: ')) {
      const refRel = headRaw.slice(5).trim()
      const refPath = join(gitDir, refRel)
      if (!existsSync(refPath)) return null
      const sha = readFileSync(refPath, 'utf8').trim()
      return sha.length >= 7 ? sha.slice(0, 40) : null
    }
    return headRaw.length >= 7 ? headRaw.slice(0, 40) : null
  } catch {
    return null
  }
}

export function isRepoIndexCacheFresh(
  index: RepoIndex,
  cwd: string,
  options?: { now?: number; gitHead?: string | null },
): boolean {
  const now = options?.now ?? Date.now()
  if (index.cwd !== cwd) return false
  if (now - index.indexedAt > REPO_INDEX_CACHE_TTL_MS) return false
  // Newer caches record gitHead; legacy caches without it stay TTL-only.
  if (index.gitHead != null && index.gitHead !== '') {
    const current = options?.gitHead ?? readGitHeadSync(cwd)
    if (current == null || current !== index.gitHead) return false
  }
  return true
}

export function readRepoIndexCache(cwd: string): RepoIndex | null {
  const cachePath = repoIndexCachePath(cwd)
  if (!existsSync(cachePath)) return null
  try {
    const cached = JSON.parse(readFileSync(cachePath, 'utf8')) as RepoIndex
    if (!isRepoIndexCacheFresh(cached, cwd)) return null
    return cached
  } catch {
    return null
  }
}

export function writeRepoIndexCache(index: RepoIndex): void {
  const dir = join(getGraftHome(), 'repo-index')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(repoIndexCachePath(index.cwd), JSON.stringify(index), {
    mode: 0o600,
  })
}