import { getCwd } from '../../../utils/cwd.js'
import { isTovyrRuntime } from '../../../utils/tovyrRuntime.js'
import { readRepoIndexCache } from './cache.js'
import { buildRankedRepoMap } from './repoMap.js'

/** Sync repo map section from the on-disk index cache (built by /repo or warm). */
export function loadRepoMapSectionSync(cwd = getCwd()): string | null {
  if (!isTovyrRuntime()) return null
  if (process.env.TOVYR_REPO_MAP === '0') return null

  const index = readRepoIndexCache(cwd)
  if (!index || index.symbols.length === 0) return null

  const map = buildRankedRepoMap(index, { maxChars: 8_000 })
  if (!map || map.length < 80) return null

  return [
    '# Repository map (cached)',
    '',
    'Ranked symbols for navigation — open files on demand; do not assume unseen code.',
    '',
    map,
  ].join('\n')
}

/** Warm the repo index cache in the background (session start). */
export function warmRepoMapCache(cwd = getCwd()): void {
  if (!isTovyrRuntime() || process.env.TOVYR_REPO_MAP === '0') return
  if (readRepoIndexCache(cwd)) return
  void import('./analyze.js').then(({ getOrBuildIndex }) =>
    getOrBuildIndex(cwd).catch(() => undefined),
  )
}