import { execFileNoThrowWithCwd } from '../../../utils/execFileNoThrow.js'
import { gitExe } from '../../../utils/git.js'
import { buildRepoIndexParallel } from './parallelIndex.js'
import { buildImportGraph, formatGraphMermaid, formatGraphText } from './graph.js'
import {
  formatFileResults,
  formatSymbolResults,
  searchFiles,
  searchSymbols,
} from './search.js'
import {
  readGitHeadSync,
  readRepoIndexCache,
  writeRepoIndexCache,
} from './cache.js'
import {
  readProjectRepoIndexCache,
  writeProjectRepoIndexCache,
} from './projectCache.js'
import { summarizeIndex } from './indexer.js'
import type { RepoIndex } from './types.js'

export async function listTrackedFiles(cwd: string): Promise<string[]> {
  const { stdout, code } = await execFileNoThrowWithCwd(
    cwd,
    gitExe(),
    ['ls-files'],
    { timeout: 60_000 },
  )
  if (code === 0 && stdout.trim()) {
    return stdout.split('\n').filter(Boolean)
  }
  return []
}

export async function getOrBuildIndex(cwd: string, force = false): Promise<RepoIndex> {
  const gitHead = readGitHeadSync(cwd)
  if (!force) {
    const projectCached = readProjectRepoIndexCache(cwd)
    if (projectCached) return projectCached
    const cached = readRepoIndexCache(cwd)
    if (cached) return cached
  }

  const files = await listTrackedFiles(cwd)
  const index: RepoIndex = {
    ...(await buildRepoIndexParallel(cwd, files)),
    ...(gitHead ? { gitHead } : {}),
  }
  writeRepoIndexCache(index)
  writeProjectRepoIndexCache(index)
  return index
}

export async function repoAnalyzeSummary(cwd: string): Promise<string> {
  const index = await getOrBuildIndex(cwd)
  return summarizeIndex(index)
}

export async function repoGraphOutput(
  cwd: string,
  format: 'text' | 'mermaid' = 'text',
): Promise<string> {
  const index = await getOrBuildIndex(cwd)
  const graph = buildImportGraph(index)
  return format === 'mermaid' ? formatGraphMermaid(graph) : formatGraphText(graph)
}

export async function repoSearchQuery(cwd: string, query: string): Promise<string> {
  const index = await getOrBuildIndex(cwd)
  const symbols = searchSymbols(index, query)
  const files = searchFiles(index, query)
  return [
    formatSymbolResults(symbols, query),
    '',
    formatFileResults(files, query),
  ].join('\n')
}