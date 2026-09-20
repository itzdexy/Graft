import type { ImportEdge, RepoIndex } from './types.js'

export type GraphNode = {
  id: string
  label: string
  symbolCount: number
}

export type GraphEdge = {
  from: string
  to: string
  count: number
}

export type ImportGraph = {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

/** Aggregate import edges into a file-level directed graph. */
export function buildImportGraph(index: RepoIndex): ImportGraph {
  const symbolCount = new Map<string, number>()
  for (const s of index.symbols) {
    symbolCount.set(s.file, (symbolCount.get(s.file) ?? 0) + 1)
  }

  const edgeCounts = new Map<string, number>()
  for (const imp of index.imports) {
    const resolved = resolveImportTarget(imp, index)
    if (!resolved) continue
    const key = `${imp.from}→${resolved}`
    edgeCounts.set(key, (edgeCounts.get(key) ?? 0) + 1)
  }

  const nodeSet = new Set<string>()
  for (const f of index.files) nodeSet.add(f)
  for (const key of edgeCounts.keys()) {
    const [from, to] = key.split('→')
    nodeSet.add(from!)
    nodeSet.add(to!)
  }

  const nodes: GraphNode[] = [...nodeSet].sort().map(id => ({
    id,
    label: id,
    symbolCount: symbolCount.get(id) ?? 0,
  }))

  const edges: GraphEdge[] = [...edgeCounts.entries()].map(([key, count]) => {
    const [from, to] = key.split('→')
    return { from: from!, to: to!, count }
  })

  return { nodes, edges }
}

function resolveImportTarget(imp: ImportEdge, index: RepoIndex): string | null {
  const spec = imp.to
  if (spec.startsWith('.')) {
    const base = imp.from.replace(/[/\\][^/\\]+$/, '')
    const joined = normalizePath(`${base}/${spec}`)
    const candidates = [
      joined,
      `${joined}.ts`,
      `${joined}.tsx`,
      `${joined}.js`,
      `${joined}/index.ts`,
      `${joined}/index.tsx`,
    ]
    for (const c of candidates) {
      const norm = normalizePath(c)
      if (index.files.includes(norm)) return norm
    }
    return null
  }
  return null
}

function normalizePath(p: string): string {
  const parts = p.split(/[/\\]+/)
  const stack: string[] = []
  for (const part of parts) {
    if (part === '.' || part === '') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return stack.join('/')
}

export function formatGraphMermaid(graph: ImportGraph, maxEdges = 40): string {
  const lines = ['```mermaid', 'flowchart LR']
  const edgeSlice = graph.edges
    .sort((a, b) => b.count - a.count)
    .slice(0, maxEdges)

  const idMap = new Map<string, string>()
  let n = 0
  for (const node of graph.nodes) {
    idMap.set(node.id, `n${n++}`)
  }

  for (const e of edgeSlice) {
    const from = idMap.get(e.from)
    const to = idMap.get(e.to)
    if (from && to) {
      lines.push(`  ${from}["${e.from}"] --> ${to}["${e.to}"]`)
    }
  }
  lines.push('```')
  return lines.join('\n')
}

export function formatGraphText(graph: ImportGraph, maxEdges = 30): string {
  const sorted = [...graph.edges].sort((a, b) => b.count - a.count).slice(0, maxEdges)
  if (!sorted.length) return 'No relative import edges found in indexed files.'
  return [
    `Import graph (${graph.nodes.length} nodes, ${graph.edges.length} edges)`,
    '',
    ...sorted.map(e => `${e.from} → ${e.to} (${e.count})`),
  ].join('\n')
}
