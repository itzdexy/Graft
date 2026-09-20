/**
 * Project-local repo index cache (Phase 3).
 * When GRAFT_REPO_INDEX_LOCAL=1, mirror index under `.graft/repo-index/`.
 */

import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { RepoIndex } from './types.js'
import { isRepoIndexCacheFresh, readGitHeadSync } from './cache.js'

export function isProjectRepoIndexEnabled(): boolean {
  return process.env.GRAFT_REPO_INDEX_LOCAL === '1'
}

export function projectRepoIndexPath(cwd: string): string {
  const hash = createHash('sha256').update(cwd.replace(/\\/g, '/')).digest('hex').slice(0, 12)
  return join(cwd, '.graft', 'repo-index', `${hash}.json`)
}

export function readProjectRepoIndexCache(cwd: string): RepoIndex | null {
  if (!isProjectRepoIndexEnabled()) return null
  const path = projectRepoIndexPath(cwd)
  if (!existsSync(path)) return null
  try {
    const cached = JSON.parse(readFileSync(path, 'utf8')) as RepoIndex
    if (!isRepoIndexCacheFresh(cached, cwd)) return null
    return cached
  } catch {
    return null
  }
}

export function writeProjectRepoIndexCache(index: RepoIndex): void {
  if (!isProjectRepoIndexEnabled()) return
  const dir = join(index.cwd, '.graft', 'repo-index')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const withHead = { ...index, gitHead: index.gitHead ?? readGitHeadSync(index.cwd) }
  writeFileSync(projectRepoIndexPath(index.cwd), JSON.stringify(withHead), {
    mode: 0o600,
  })
}
