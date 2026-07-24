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
  const maxChars = options?.maxChars ?? 12_000
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
    }))
    .filter(x => x.score >= 0)
    .sort((a, b) => b.score - a.score)

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

    const chunk = [
      `## ${file}`,
      ...rankedSyms.map(
        ({ s }) => `- ${s.kind} ${s.name} (L${s.line})`,
      ),
      '',
    ].join('\n')

    if (used + chunk.length > maxChars) break
    lines.push(chunk)
    used += chunk.length
  }

  if (lines.length <= 3) {
    lines.push('(No symbols indexed — run `/repo analyze` after `git ls-files` is available.)')
  }

  return lines.join('\n')
}
