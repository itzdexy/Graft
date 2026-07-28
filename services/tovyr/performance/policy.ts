/**
 * Performance policy helpers (Phase 9).
 */

import { isProjectRepoIndexEnabled } from '../repo/projectCache.js'

export const AGENT_SAVE_DEBOUNCE_MS = 250

export function shouldLazyRepoIndex(): boolean {
  return process.env.TOVYR_LAZY_REPO_INDEX !== '0'
}

export function shouldUseParallelRepoIndex(fileCount: number): boolean {
  return fileCount >= Number(process.env.TOVYR_PARALLEL_INDEX_MIN ?? 40)
}

export function repoIndexCacheStrategy(): string {
  const parts = ['~/.tovyr/repo-index']
  if (isProjectRepoIndexEnabled()) parts.push('.tovyr/repo-index (project)')
  if (shouldLazyRepoIndex()) parts.push('lazy until /repo or agent')
  return parts.join(' · ')
}

export function formatPerformanceHints(): string {
  return [
    '# Tovyr performance',
    '',
    `- Repo index cache: ${repoIndexCacheStrategy()}`,
    '- Set TOVYR_REPO_INDEX_LOCAL=1 for project-local cache',
    '- Set TOVYR_LAZY_REPO_INDEX=0 to eager-index on startup',
    '- Agent state saves on phase transitions only (not per tool call)',
    '- Memory search cached in buddy/memoryCache.ts',
  ].join('\n')
}
