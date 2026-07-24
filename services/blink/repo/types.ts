export type RepoSymbolKind =
  | 'function'
  | 'class'
  | 'interface'
  | 'type'
  | 'export'
  | 'import'
  | 'const'
  | 'enum'

export type RepoSymbol = {
  name: string
  kind: RepoSymbolKind
  file: string
  line: number
}

export type ImportEdge = {
  from: string
  to: string
  line: number
}

export type RepoIndex = {
  cwd: string
  files: string[]
  symbols: RepoSymbol[]
  imports: ImportEdge[]
  indexedAt: number
  /** Git HEAD at index time — invalidates cache after commits (optional for legacy caches). */
  gitHead?: string
}

export type RepoSearchHit = {
  file: string
  line: number
  text: string
  score: number
}
