import { buildImportGraph, type ImportGraph } from './graph.js'
import { searchFiles } from './search.js'
import type { RepoIndex } from './types.js'

export type ProjectMapNode = {
  /** Relative path from repo root (dirs end without trailing slash). */
  path: string
  name: string
  isDirectory: boolean
  children: ProjectMapNode[]
  relevant: boolean
  score: number
}

export type ProjectMapEdge = {
  from: string
  to: string
}

export type TaskProjectMap = {
  rootLabel: string
  tree: ProjectMapNode[]
  relevantPaths: string[]
  edges: ProjectMapEdge[]
  indexed: boolean
  fileCount: number
}

const SKIP_PATH =
  /(?:^|[\\/])(node_modules|\.git|dist|build|coverage|\.next|vendor)(?:[\\/]|$)/

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\W+/)
    .filter(t => t.length > 1)
}

function scoreFileForTask(
  index: RepoIndex,
  file: string,
  terms: string[],
  seeds: Set<string>,
): number {
  if (SKIP_PATH.test(file)) return -1
  let score = 0
  if (seeds.has(file)) score += 250

  const pathLower = file.toLowerCase()
  const base = file.split(/[/\\]/).pop()?.toLowerCase() ?? ''
  for (const term of terms) {
    if (pathLower.includes(term)) score += 18
    if (base.includes(term)) score += 12
    if (base.replace(/\.(tsx?|jsx?|mjs|cjs)$/, '').includes(term)) score += 8
  }

  for (const sym of index.symbols) {
    if (sym.file !== file) continue
    const name = sym.name.toLowerCase()
    for (const term of terms) {
      if (name === term) score += 25
      else if (name.includes(term)) score += 10
    }
  }

  if (/\.(test|spec)\./.test(file) && terms.some(t => /test|spec/.test(t))) {
    score += 6
  }

  return score
}

function expandWithImportNeighbors(
  graph: ImportGraph,
  ranked: Map<string, number>,
  maxHops = 1,
): void {
  const queue = [...ranked.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path]) => path)

  for (let hop = 0; hop < maxHops; hop++) {
    const next: string[] = []
    for (const path of queue) {
      for (const edge of graph.edges) {
        if (edge.from === path && !ranked.has(edge.to)) {
          ranked.set(edge.to, Math.max(1, (ranked.get(path) ?? 0) - 12))
          next.push(edge.to)
        }
        if (edge.to === path && !ranked.has(edge.from)) {
          ranked.set(edge.from, Math.max(1, (ranked.get(path) ?? 0) - 8))
          next.push(edge.from)
        }
      }
    }
    queue.splice(0, queue.length, ...next)
  }
}

function buildTreeFromPaths(
  paths: string[],
  relevant: Set<string>,
  scores: Map<string, number>,
): ProjectMapNode[] {
  type Builder = {
    name: string
    path: string
    isDirectory: boolean
    children: Map<string, Builder>
    relevant: boolean
    score: number
  }

  const roots = new Map<string, Builder>()

  function ensureDir(dirPath: string): void {
    if (!dirPath) return
    const parts = dirPath.split('/')
    let current = roots
    let built = ''
    for (const part of parts) {
      built = built ? `${built}/${part}` : part
      if (!current.has(part)) {
        current.set(part, {
          name: part,
          path: built,
          isDirectory: true,
          children: new Map(),
          relevant: false,
          score: 0,
        })
      }
      current = current.get(part)!.children
    }
  }

  for (const file of paths) {
    const parts = file.split('/')
    for (let i = 1; i < parts.length; i++) {
      ensureDir(parts.slice(0, i).join('/'))
    }

    let current = roots
    let built = ''
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!
      const isLast = i === parts.length - 1
      built = built ? `${built}/${part}` : part

      if (!current.has(part)) {
        current.set(part, {
          name: part,
          path: built,
          isDirectory: !isLast,
          children: new Map(),
          relevant: false,
          score: 0,
        })
      }

      const node = current.get(part)!
      if (isLast) {
        node.isDirectory = false
        node.relevant = relevant.has(file)
        node.score = scores.get(file) ?? 0
      }
      current = node.children
    }
  }

  function toNodes(map: Map<string, Builder>): ProjectMapNode[] {
    return [...map.values()]
      .map(n => ({
        path: n.path,
        name: n.name,
        isDirectory: n.isDirectory,
        children: toNodes(n.children),
        relevant: n.relevant,
        score: n.score,
      }))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        if (a.relevant !== b.relevant) return a.relevant ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }

  return toNodes(roots)
}

/**
 * Build a focused project tree + import edges for the current task query.
 * Uses cached RepoIndex when available; callers pass null while indexing.
 */
export function buildTaskProjectMap(
  index: RepoIndex | null,
  options?: {
    query?: string
    seedPaths?: string[]
    maxFiles?: number
    maxEdges?: number
  },
): TaskProjectMap {
  const rootLabel = index?.cwd.split(/[/\\]/).pop() ?? 'repo'
  const maxFiles = options?.maxFiles ?? 14
  const maxEdges = options?.maxEdges ?? 6
  const query = options?.query?.trim() ?? ''
  const seeds = new Set(
    (options?.seedPaths ?? []).map(p => p.replace(/\\/g, '/')),
  )

  if (!index || index.files.length === 0) {
    return {
      rootLabel,
      tree: [],
      relevantPaths: [],
      edges: [],
      indexed: false,
      fileCount: 0,
    }
  }

  const terms = tokenizeQuery(query)
  const ranked = new Map<string, number>()

  if (query) {
    for (const file of searchFiles(index, query, 20)) {
      ranked.set(file, (ranked.get(file) ?? 0) + 40)
    }
    for (const file of index.files) {
      const score = scoreFileForTask(index, file, terms, seeds)
      if (score > 0) ranked.set(file, Math.max(ranked.get(file) ?? 0, score))
    }
    const graph = buildImportGraph(index)
    expandWithImportNeighbors(graph, ranked)
  }

  const topFiles = [...ranked.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxFiles)
    .map(([file]) => file)

  const relevantSet = new Set(topFiles)
  const scoreMap = new Map(ranked)

  const pathsForTree =
    topFiles.length > 0
      ? topFiles
      : !query
        ? (() => {
            const bySymbols = new Map<string, number>()
            for (const s of index.symbols) {
              if (SKIP_PATH.test(s.file)) continue
              bySymbols.set(s.file, (bySymbols.get(s.file) ?? 0) + 1)
            }
            return [...bySymbols.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([file]) => file)
          })()
        : []

  const tree = buildTreeFromPaths(pathsForTree, relevantSet, scoreMap)

  const graph = buildImportGraph(index)
  const edges: ProjectMapEdge[] = graph.edges
    .filter(e => relevantSet.has(e.from) && relevantSet.has(e.to))
    .sort((a, b) => b.count - a.count)
    .slice(0, maxEdges)
    .map(e => ({ from: e.from, to: e.to }))

  return {
    rootLabel,
    tree,
    relevantPaths: topFiles,
    edges,
    indexed: true,
    fileCount: index.files.length,
  }
}

/** Short label for terminal map rows. */
export function shortenMapPath(path: string, max = 22): string {
  if (path.length <= max) return path
  const parts = path.split('/')
  if (parts.length <= 2) return `…${path.slice(-max + 1)}`
  return `…/${parts.slice(-2).join('/')}`
}
