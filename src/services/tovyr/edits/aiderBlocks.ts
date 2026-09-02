export type AiderBlock = {
  search: string
  replace: string
}

export type ApplyAiderBlocksResult = {
  content: string
  applied: number
  failures: string[]
  /** Non-fatal notices (e.g. SEARCH matched multiple times). */
  warnings: string[]
  /** How each applied block matched: 'exact' or 'whitespace' (fuzzy). */
  matches: Array<'exact' | 'whitespace'>
}

export function hasAiderBlockMarkers(text: string): boolean {
  return text.includes('<<<<<<< SEARCH')
}

// Marker lines are matched after trimming trailing whitespace/CR, so a model
// that drifts (e.g. emits "=======  " or "<<<<<<< SEARCH ") still parses.
const SEARCH_START = '<<<<<<< SEARCH'
const DIVIDER = '======='
const REPLACE_END = '>>>>>>> REPLACE'

function isMarker(line: string, marker: string): boolean {
  return line.replace(/[ \t\r]+$/, '') === marker
}

/**
 * Parse SEARCH/REPLACE blocks by scanning lines rather than with one greedy
 * regex. This is tolerant of the cases a single regex got wrong:
 *   - empty REPLACE (a deletion: `=======` immediately followed by the end
 *     marker, with no intervening blank line),
 *   - empty SEARCH (a new-file insert: SEARCH immediately followed by the
 *     divider),
 *   - trailing whitespace on any marker line.
 * Inner line endings are preserved by re-joining with the EOL detected from the
 * source text, so a CRLF block stays CRLF.
 */
export function parseAiderBlocks(text: string): AiderBlock[] {
  const blocks: AiderBlock[] = []
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)

  let i = 0
  while (i < lines.length) {
    if (!isMarker(lines[i]!, SEARCH_START)) {
      i++
      continue
    }
    i++ // consume the SEARCH marker

    const searchLines: string[] = []
    while (i < lines.length && !isMarker(lines[i]!, DIVIDER)) {
      searchLines.push(lines[i]!)
      i++
    }
    if (i >= lines.length) break // malformed: no divider — drop trailing block
    i++ // consume the divider

    const replaceLines: string[] = []
    while (i < lines.length && !isMarker(lines[i]!, REPLACE_END)) {
      replaceLines.push(lines[i]!)
      i++
    }
    if (i >= lines.length) break // malformed: no end marker — drop trailing block
    i++ // consume the REPLACE marker

    blocks.push({
      search: searchLines.join(eol),
      replace: replaceLines.join(eol),
    })
  }

  return blocks
}

function detectEol(text: string): '\r\n' | '\n' {
  return text.includes('\r\n') ? '\r\n' : '\n'
}

function countExactMatches(content: string, search: string): number {
  if (!search) return 0
  let count = 0
  let pos = 0
  while (pos <= content.length) {
    const idx = content.indexOf(search, pos)
    if (idx === -1) break
    count++
    pos = idx + search.length
  }
  return count
}

/** Trailing-whitespace-insensitive line key (also unifies CRLF vs LF). */
function normalizeLine(line: string): string {
  return line.replace(/[ \t]+$/, '')
}

/**
 * Fallback when an exact SEARCH fails: match line-by-line ignoring trailing
 * whitespace and line-ending differences — the most common drift between what
 * a model emits and what's actually on disk. Indentation and inner content
 * must still match exactly, so we never silently edit the wrong place. Returns
 * the new content, or null if no window matches.
 */
function countWhitespaceTolerantMatches(
  content: string,
  search: string,
): number {
  const contentLines = content.split(/\r?\n/)
  const searchLines = search.split(/\r?\n/)
  const n = searchLines.length
  if (n === 0) return 0

  const normSearch = searchLines.map(normalizeLine)
  let count = 0
  for (let i = 0; i + n <= contentLines.length; i++) {
    let matched = true
    for (let j = 0; j < n; j++) {
      if (normalizeLine(contentLines[i + j]!) !== normSearch[j]) {
        matched = false
        break
      }
    }
    if (matched) count++
  }
  return count
}

function applyWhitespaceTolerant(
  content: string,
  search: string,
  replace: string,
): string | null {
  const eol = detectEol(content)
  const contentLines = content.split(/\r?\n/)
  const searchLines = search.split(/\r?\n/)
  const n = searchLines.length
  if (n === 0) return null

  const normSearch = searchLines.map(normalizeLine)
  // An empty replace is a deletion: it must remove the matched lines, not
  // substitute a single blank line ([''] is what split('') would yield).
  const replaceLines = replace === '' ? [] : replace.split(/\r?\n/)

  for (let i = 0; i + n <= contentLines.length; i++) {
    let matched = true
    for (let j = 0; j < n; j++) {
      if (normalizeLine(contentLines[i + j]!) !== normSearch[j]) {
        matched = false
        break
      }
    }
    if (matched) {
      const next = [
        ...contentLines.slice(0, i),
        ...replaceLines,
        ...contentLines.slice(i + n),
      ]
      return next.join(eol)
    }
  }
  return null
}

/** Apply SEARCH/REPLACE blocks in order (first match per block). */
export function applyAiderBlocks(
  fileContent: string,
  blocks: AiderBlock[],
): ApplyAiderBlocksResult {
  let content = fileContent
  let applied = 0
  const failures: string[] = []
  const warnings: string[] = []
  const matches: Array<'exact' | 'whitespace'> = []

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]!

    // Empty SEARCH is only meaningful for an empty/new file (full insert).
    // Applying it to a non-empty file would corrupt it (indexOf('') === 0),
    // so reject it explicitly rather than inserting at the top.
    if (block.search.length === 0) {
      if (content.trim().length === 0) {
        content = block.replace
        applied++
        matches.push('exact')
      } else {
        failures.push(
          `Block ${i + 1}: empty SEARCH is only allowed on an empty file`,
        )
      }
      continue
    }

    // Deletion (empty REPLACE): prefer whole-line removal so a full-line
    // SEARCH doesn't leave a dangling blank line (substring replace with ''
    // would keep the line's trailing newline). Falls through to substring
    // matching below for mid-line / partial deletions that don't align to a
    // whole line.
    if (block.replace === '') {
      const removed = applyWhitespaceTolerant(content, block.search, '')
      if (removed !== null) {
        content = removed
        applied++
        matches.push('whitespace')
        continue
      }
    }

    const idx = content.indexOf(block.search)
    if (idx !== -1) {
      const occurrences = countExactMatches(content, block.search)
      if (occurrences > 1) {
        warnings.push(
          `Block ${i + 1}: SEARCH matched ${occurrences} locations; edited the first. Add surrounding lines for a unique match.`,
        )
      }
      content =
        content.slice(0, idx) +
        block.replace +
        content.slice(idx + block.search.length)
      applied++
      matches.push('exact')
      continue
    }

    const tolerant = applyWhitespaceTolerant(content, block.search, block.replace)
    if (tolerant !== null) {
      const occurrences = countWhitespaceTolerantMatches(content, block.search)
      if (occurrences > 1) {
        warnings.push(
          `Block ${i + 1}: SEARCH matched ${occurrences} locations (whitespace-tolerant); edited the first. Add surrounding lines for a unique match.`,
        )
      }
      content = tolerant
      applied++
      matches.push('whitespace')
      continue
    }

    failures.push(`Block ${i + 1}: SEARCH text not found in file`)
  }

  return { content, applied, failures, warnings, matches }
}
