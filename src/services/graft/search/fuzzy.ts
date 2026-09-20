/**
 * Deterministic fuzzy matching for Graft pickers (providers, models, commands).
 *
 * The pickers rank two kinds of haystack — human labels ("Claude Opus 4.5")
 * and machine ids ("anthropic/claude-opus-4-5-20251101") — so the scorer is
 * built around segment boundaries (`-`, `_`, `/`, `.`, space, camelCase)
 * rather than raw character distance. That is what makes "copus" find
 * "claude-opus" and "gpt5" find "openai/gpt-5" without also dragging in every
 * id that happens to contain those letters.
 *
 * Multi-word queries are AND-ed: every whitespace-separated token must match
 * somewhere, and the per-token scores are summed. "claude opus" therefore
 * ranks `claude-opus-4-5` above `claude-sonnet` even though both contain
 * "claude".
 */

export type FuzzyMatch = {
  /** Higher is better. Only meaningful relative to other matches. */
  score: number
  /** Indices in the haystack that the query matched, for highlighting. */
  indices: number[]
}

const SEGMENT_SEPARATORS = new Set([
  '-',
  '_',
  '/',
  '.',
  ':',
  ' ',
  '\t',
  '(',
  ')',
  '[',
  ']',
])

/** Score weights. Tuned so the ordering is: exact > prefix > boundary > substring > subsequence. */
const SCORE = {
  exact: 1_000,
  prefix: 600,
  boundaryPrefix: 400,
  substring: 200,
  subsequence: 60,
  /** Per-character bonus for a run of consecutive matches. */
  consecutive: 12,
  /** Bonus when a matched character starts a segment ("-o" in claude-opus). */
  boundaryHit: 25,
  /** Penalty per character of unmatched leading text. */
  leadingGap: 2,
  /** Penalty per extra character in the haystack — prefers tighter matches. */
  length: 0.5,
} as const

function isSegmentStart(text: string, index: number): boolean {
  if (index === 0) return true
  const previous = text[index - 1]!
  if (SEGMENT_SEPARATORS.has(previous)) return true
  // camelCase / digit boundaries: "gpt4o" → the "4" starts a segment.
  const current = text[index]!
  if (/[a-z]/.test(previous) && /[A-Z0-9]/.test(current)) return true
  return false
}

/**
 * Match a single whitespace-free token. Returns null when the token is not a
 * subsequence of the haystack at all.
 */
function matchToken(
  haystack: string,
  lowerHaystack: string,
  token: string,
): FuzzyMatch | null {
  if (!token) return { score: 0, indices: [] }
  if (token.length > haystack.length) return null

  const lengthPenalty = haystack.length * SCORE.length

  if (lowerHaystack === token) {
    return {
      score: SCORE.exact - lengthPenalty,
      indices: range(0, token.length),
    }
  }

  const substringAt = lowerHaystack.indexOf(token)
  if (substringAt === 0) {
    return {
      score: SCORE.prefix - lengthPenalty,
      indices: range(0, token.length),
    }
  }
  if (substringAt > 0) {
    const base = isSegmentStart(haystack, substringAt)
      ? SCORE.boundaryPrefix
      : SCORE.substring
    return {
      score: base - substringAt * SCORE.leadingGap - lengthPenalty,
      indices: range(substringAt, substringAt + token.length),
    }
  }

  // Fall back to a subsequence walk that prefers segment starts. Greedy from
  // the left is enough here: picker haystacks are short and the boundary bonus
  // does the discriminating work.
  //
  // Every run of matched characters must *begin* at a segment boundary. Without
  // that rule short tokens turn into noise — "opus" is a subsequence of
  // "anthropic/claude-sonnet-5" (o·p in anthro**p**ic, u in cla**u**de,
  // s in **s**onnet) and would pollute every list. Requiring boundary starts
  // keeps the useful abbreviations ("gpt5" → openai/gpt-5, "cs5" →
  // claude-sonnet-5) and drops the accidental ones.
  const indices: number[] = []
  let cursor = 0
  let consecutiveRun = 0
  let bonus = 0

  for (const char of token) {
    const previous = indices[indices.length - 1]
    let found = -1

    if (previous !== undefined && lowerHaystack[previous + 1] === char) {
      // Continuing the current run always wins. Without this the
      // boundary preference below jumps mid-word — matching "anthropic/…"
      // it would abandon the 'c' of anthropi(c) for the 'c' of /(c)laude
      // and then fail on the '/' that no longer lies ahead.
      found = previous + 1
    } else {
      // Prefer a segment-start occurrence over the next raw occurrence, so
      // "cs" matches claude-sonnet on the 's' of 'sonnet', not of 'claude'.
      for (let i = cursor; i < lowerHaystack.length; i++) {
        if (lowerHaystack[i] !== char) continue
        if (found === -1) found = i
        if (isSegmentStart(haystack, i)) {
          found = i
          break
        }
      }
    }
    if (found === -1) return null

    const continuesRun = previous !== undefined && found === previous + 1
    if (continuesRun) {
      consecutiveRun += 1
      bonus += consecutiveRun * SCORE.consecutive
    } else {
      // Start of a new run — only legal at a segment boundary.
      if (!isSegmentStart(haystack, found)) return null
      consecutiveRun = 0
      bonus += SCORE.boundaryHit
    }

    indices.push(found)
    cursor = found + 1
  }

  const firstIndex = indices[0] ?? 0
  return {
    score:
      SCORE.subsequence + bonus - firstIndex * SCORE.leadingGap - lengthPenalty,
    indices,
  }
}

function range(from: number, to: number): number[] {
  const out: number[] = []
  for (let i = from; i < to; i++) out.push(i)
  return out
}

/** Split a query into lowercase tokens. Empty query yields no tokens. */
export function tokenizeQuery(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

/**
 * Match `query` against a single haystack string.
 * Returns null when any query token is absent.
 */
export function fuzzyMatch(haystack: string, query: string): FuzzyMatch | null {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return { score: 0, indices: [] }

  const lowerHaystack = haystack.toLowerCase()
  let score = 0
  const indices = new Set<number>()

  for (const token of tokens) {
    const match = matchToken(haystack, lowerHaystack, token)
    if (!match) return null
    score += match.score
    for (const index of match.indices) indices.add(index)
  }

  return { score, indices: [...indices].sort((a, b) => a - b) }
}

export type FuzzyField = {
  /** Text to match against. */
  text: string
  /**
   * Relative importance. A label match on weight 1 beats an id match on
   * weight 0.6 at equal raw score.
   */
  weight?: number
  /** When true, matched indices from this field are returned for highlighting. */
  highlight?: boolean
}

export type FuzzyResult<T> = {
  item: T
  score: number
  /** Indices into the field marked `highlight` (or the first field). */
  indices: number[]
}

/**
 * Rank `items` against `query`. An item survives when at least one of its
 * fields matches every query token; its score is the best weighted field score.
 *
 * Ties break on the original order, so an unfiltered list keeps whatever
 * ordering the caller built (catalog order, tier order, …).
 */
export function fuzzyRank<T>(
  items: readonly T[],
  query: string,
  getFields: (item: T) => readonly (FuzzyField | string)[],
): FuzzyResult<T>[] {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) {
    return items.map(item => ({ item, score: 0, indices: [] }))
  }

  const results: Array<FuzzyResult<T> & { order: number }> = []

  items.forEach((item, order) => {
    const fields = getFields(item).map(field =>
      typeof field === 'string' ? { text: field } : field,
    )
    let best: { score: number; indices: number[] } | null = null
    let highlightIndices: number[] = []

    for (const [fieldIndex, field] of fields.entries()) {
      const match = fuzzyMatch(field.text, query)
      if (!match) continue
      const weighted = match.score * (field.weight ?? 1)
      const isHighlightField = field.highlight ?? fieldIndex === 0
      if (isHighlightField && highlightIndices.length === 0) {
        highlightIndices = match.indices
      }
      if (!best || weighted > best.score) {
        best = { score: weighted, indices: match.indices }
      }
    }

    if (!best) return
    results.push({
      item,
      score: best.score,
      indices: highlightIndices.length > 0 ? highlightIndices : best.indices,
      order,
    })
  })

  results.sort((a, b) => b.score - a.score || a.order - b.order)
  return results.map(({ item, score, indices }) => ({ item, score, indices }))
}

/** Convenience wrapper returning just the matching items, ranked. */
export function fuzzyFilter<T>(
  items: readonly T[],
  query: string,
  getFields: (item: T) => readonly (FuzzyField | string)[],
): T[] {
  return fuzzyRank(items, query, getFields).map(result => result.item)
}
