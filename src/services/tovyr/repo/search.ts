import type { RepoIndex, RepoSearchHit, RepoSymbol } from './types.js'

export function searchSymbols(
  index: RepoIndex,
  query: string,
  limit = 25,
): RepoSymbol[] {
  const q = query.trim().toLowerCase()
  if (!q) return index.symbols.slice(0, limit)

  const scored = index.symbols
    .map(s => ({ s, score: scoreSymbol(s, q) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limit).map(x => x.s)
}

export function searchFiles(index: RepoIndex, query: string, limit = 25): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return index.files.slice(0, limit)

  return index.files
    .map(f => ({ f, score: scorePath(f, q) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.f)
}

export function searchContentLines(
  lines: string[],
  file: string,
  query: string,
): RepoSearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: RepoSearchHit[] = []
  for (let i = 0; i < lines.length; i++) {
    const text = lines[i]!
    const lower = text.toLowerCase()
    if (!lower.includes(q)) continue
    hits.push({
      file,
      line: i + 1,
      text: text.trim().slice(0, 200),
      score: scoreLine(text, q),
    })
  }
  return hits.sort((a, b) => b.score - a.score)
}

function scoreSymbol(s: RepoSymbol, q: string): number {
  const name = s.name.toLowerCase()
  if (name === q) return 100
  if (name.startsWith(q)) return 80
  if (name.includes(q)) return 50
  if (s.file.toLowerCase().includes(q)) return 20
  return 0
}

function scorePath(path: string, q: string): number {
  const lower = path.toLowerCase()
  if (lower === q) return 100
  if (lower.endsWith(q)) return 85
  if (lower.includes(q)) return 50
  return 0
}

export function scoreLine(text: string, q: string): number {
  const lower = text.toLowerCase()
  if (lower === q) return 100
  if (lower.includes(q)) return 40 + Math.min(30, q.length)
  return 0
}

export function formatSymbolResults(symbols: RepoSymbol[], query: string): string {
  if (!symbols.length) return `No symbols matching "${query}".`
  return [
    `Symbol search: "${query}" (${symbols.length} results)`,
    '',
    ...symbols.map(s => `- ${s.name} [${s.kind}] — ${s.file}:${s.line}`),
  ].join('\n')
}

export function formatFileResults(files: string[], query: string): string {
  if (!files.length) return `No files matching "${query}".`
  return [`File search: "${query}"`, '', ...files.map(f => `- ${f}`)].join('\n')
}
