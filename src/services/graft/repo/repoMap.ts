import type { RepoIndex, RepoSymbol } from './types.js'

const SKIP_PATH =
  /(?:^|[\\/])(node_modules|\.git|dist|build|coverage|\.next|vendor)(?:[\\/]|$)/

function scoreSymbol(symbol: RepoSymbol, queryTerms: string[]): number {
  let score = symbol.kind === 'function' ? 3 : symbol.kind === 'class' ? 2 : 1
  const lower = symbol.name.toLowerCase()
  for (const term of queryTerms) {
    if (lower === term) score += 10
    else if (lower.includes(term)) score += 4
  }
  if (symbol.file.includes('index.')) score += 1
  return score
}

function scoreFile(file: string, symbolCount: number): number {
  if (SKIP_PATH.test(file)) return -1
  let score = symbolCount
  if (file.endsWith('index.ts') || file.endsWith('index.tsx')) score += 2
  if (/\.(test|spec)\./.test(file)) score -= 2
  return score
}

/** Ranked repo map sized to a character budget (Aider-style context). */
export function buildRankedRepoMap(
  index: RepoIndex,
  options?: { maxChars?: number; query?: string },
): string {
  const requestedBudget = options?.maxChars ?? 12_000
  const maxChars = Number.isFinite(requestedBudget) ? Math.max(0, Math.floor(requestedBudget)) : 12_000
  const queryTerms = (options?.query ?? '')
    .toLowerCase()
    .split(/\W+/)
    .filter(t => t.length > 1)

  const symbolsByFile = new Map<string, RepoSymbol[]>()
  for (const s of index.symbols) {
    if (SKIP_PATH.test(s.file)) continue
    const list = symbolsByFile.get(s.file) ?? []
    list.push(s)
    symbolsByFile.set(s.file, list)
  }

  const rankedFiles = [...symbolsByFile.entries()]
    .map(([file, syms]) => ({
      file,
      syms,
      score: scoreFile(file, syms.length),
      relevance: queryTerms.reduce((score, term) => score + (file.toLowerCase().includes(term) ? 2 : 0) + (syms.some(s => s.name.toLowerCase().includes(term)) ? 1 : 0), 0),
    }))
    .filter(x => x.score >= 0)
    .sort((a, b) => b.relevance - a.relevance || b.score - a.score || a.file.localeCompare(b.file))

  const lines: string[] = [
    `Repo map (${index.files.length} indexed files, budget ~${maxChars} chars)`,
    `CWD: ${index.cwd}`,
    '',
  ]

  let used = lines.join('\n').length

  for (const { file, syms } of rankedFiles) {
    const rankedSyms = [...syms]
      .map(s => ({ s, score: scoreSymbol(s, queryTerms) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)

    const available = maxChars - used - 1
    const parts = [`## ${file}`]
    let length = parts[0]!.length
    for (const { s } of rankedSyms) {
      const line = `- ${s.kind} ${s.name} (L${s.line})`
      if (length + line.length + 1 > available) break
      parts.push(line)
      length += line.length + 1
    }
    if (parts.length === 1) continue
    const chunk = parts.join('\n')
    lines.push(chunk)
    used += chunk.length + 1
  }

  if (lines.length <= 3) {
    lines.push(index.symbols.length ? '(No indexed symbols fit this budget.)' : '(No symbols indexed — run `/repo analyze` after `git ls-files` is available.)')
  }

  return lines.join('\n').slice(0, maxChars)
}
