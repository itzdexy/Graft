import { describe, expect, test } from 'bun:test'
import {
  applyAiderBlocks,
  hasAiderBlockMarkers,
  parseAiderBlocks,
} from './aiderBlocks.js'

describe('aiderBlocks', () => {
  test('parses single block', () => {
    const text = `<<<<<<< SEARCH
foo
=======
bar
>>>>>>> REPLACE`
    expect(hasAiderBlockMarkers(text)).toBe(true)
    const blocks = parseAiderBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ search: 'foo', replace: 'bar' })
  })

  test('applies block when search matches', () => {
    const content = 'alpha\nfoo\nbeta'
    const blocks = parseAiderBlocks(`<<<<<<< SEARCH
foo
=======
bar
>>>>>>> REPLACE`)
    const result = applyAiderBlocks(content, blocks)
    expect(result.applied).toBe(1)
    expect(result.failures).toHaveLength(0)
    expect(result.content).toBe('alpha\nbar\nbeta')
  })

  test('reports failure when search missing', () => {
    const result = applyAiderBlocks('hello', [
      { search: 'missing', replace: 'x' },
    ])
    expect(result.applied).toBe(0)
    expect(result.failures[0]).toContain('not found')
  })

  test('multi-line block matches despite trailing-whitespace drift', () => {
    // The file has trailing spaces after "foo" that the model did not
    // reproduce, which breaks an exact multi-line substring match.
    const content = 'alpha\nfoo  \nbeta'
    const result = applyAiderBlocks(content, [
      { search: 'foo\nbeta', replace: 'FOO\nBETA' },
    ])
    expect(result.applied).toBe(1)
    expect(result.matches[0]).toBe('whitespace')
    expect(result.content).toBe('alpha\nFOO\nBETA')
  })

  test('matches despite CRLF vs LF line endings', () => {
    const content = 'one\r\ntarget line\r\nthree'
    const result = applyAiderBlocks(content, [
      { search: 'target line', replace: 'patched' },
    ])
    expect(result.applied).toBe(1)
    // Exact indexOf already finds the single line, so this is an exact match.
    expect(result.content).toContain('patched')
  })

  test('multi-line block matches with line-ending drift', () => {
    const content = 'a\r\nb\r\nc'
    const result = applyAiderBlocks(content, [
      { search: 'a\nb', replace: 'X\nY' },
    ])
    expect(result.applied).toBe(1)
    expect(result.matches[0]).toBe('whitespace')
    expect(result.content).toBe('X\r\nY\r\nc')
  })

  test('rejects empty SEARCH on a non-empty file', () => {
    const result = applyAiderBlocks('existing content', [
      { search: '', replace: 'injected' },
    ])
    expect(result.applied).toBe(0)
    expect(result.failures[0]).toContain('empty SEARCH')
    expect(result.content).toBe('existing content')
  })

  test('allows empty SEARCH on an empty file (new-file insert)', () => {
    const result = applyAiderBlocks('', [{ search: '', replace: 'hello world' }])
    expect(result.applied).toBe(1)
    expect(result.content).toBe('hello world')
  })

  test('does not fuzzy-match when leading indentation differs', () => {
    // Exact match fails (the file indents `bar`), and the fuzzy path must NOT
    // match either, since leading indentation is significant — never edit the
    // wrong place.
    const content = 'foo\n    bar\nbaz'
    const result = applyAiderBlocks(content, [
      { search: 'foo\nbar', replace: 'X\nY' },
    ])
    expect(result.applied).toBe(0)
  })

  // --- Deletion blocks (empty REPLACE) ------------------------------------

  test('parses a deletion block (empty REPLACE, no blank line)', () => {
    // The standard way a model deletes code: ======= directly followed by the
    // end marker. The old single-regex parser required a newline before
    // >>>>>>> REPLACE and returned [] for this, breaking deletions entirely.
    const text = `<<<<<<< SEARCH
old line
=======
>>>>>>> REPLACE`
    const blocks = parseAiderBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ search: 'old line', replace: '' })
  })

  test('applies a full-line deletion without leaving a blank line', () => {
    const content = 'a\nfoo\nb'
    const result = applyAiderBlocks(content, [{ search: 'foo', replace: '' }])
    expect(result.applied).toBe(1)
    expect(result.failures).toHaveLength(0)
    expect(result.content).toBe('a\nb')
  })

  test('deletes a multi-line block cleanly', () => {
    const content = 'head\nfoo\nbar\ntail'
    const result = applyAiderBlocks(content, [
      { search: 'foo\nbar', replace: '' },
    ])
    expect(result.applied).toBe(1)
    expect(result.content).toBe('head\ntail')
  })

  test('fuzzy deletion (whitespace drift) removes lines instead of blanking them', () => {
    // File has trailing whitespace the model did not reproduce. Old code's
    // fuzzy path substituted [''] -> a stray blank line; it must now remove
    // the matched lines.
    const content = 'a\nfoo  \nbar\nb'
    const result = applyAiderBlocks(content, [
      { search: 'foo\nbar', replace: '' },
    ])
    expect(result.applied).toBe(1)
    expect(result.content).toBe('a\nb')
  })

  test('still supports mid-line (partial) deletion via substring', () => {
    // No whole line equals "foo", so deletion falls back to substring removal.
    const content = 'xfooy'
    const result = applyAiderBlocks(content, [{ search: 'foo', replace: '' }])
    expect(result.applied).toBe(1)
    expect(result.content).toBe('xy')
  })

  test('parses and applies a CRLF deletion block', () => {
    const text =
      '<<<<<<< SEARCH\r\ndrop me\r\n=======\r\n>>>>>>> REPLACE'
    const blocks = parseAiderBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ search: 'drop me', replace: '' })
    const result = applyAiderBlocks('keep\r\ndrop me\r\nkeep2', blocks)
    expect(result.applied).toBe(1)
    expect(result.content).toBe('keep\r\nkeep2')
  })

  // --- Empty SEARCH (new-file insert) parsing -----------------------------

  test('parses an empty-SEARCH new-file block', () => {
    // SEARCH directly followed by the divider. The old regex could not produce
    // an empty search, leaving the new-file apply branch unreachable.
    const text = `<<<<<<< SEARCH
=======
hello world
>>>>>>> REPLACE`
    const blocks = parseAiderBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ search: '', replace: 'hello world' })
    const result = applyAiderBlocks('', blocks)
    expect(result.applied).toBe(1)
    expect(result.content).toBe('hello world')
  })

  // --- Marker tolerance ---------------------------------------------------

  test('tolerates trailing whitespace on marker lines', () => {
    // Models sometimes emit trailing spaces after the conflict markers.
    const text =
      '<<<<<<< SEARCH \nfoo\n======= \nbar\n>>>>>>> REPLACE '
    const blocks = parseAiderBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ search: 'foo', replace: 'bar' })
  })

  test('warns when SEARCH matches multiple locations but edits the first', () => {
    const content = 'dup\ndup\ndup'
    const result = applyAiderBlocks(content, [
      { search: 'dup', replace: 'ONCE' },
    ])
    expect(result.applied).toBe(1)
    expect(result.failures).toHaveLength(0)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('matched 3 locations')
    expect(result.content).toBe('ONCE\ndup\ndup')
  })

  test('warns when whitespace-tolerant SEARCH matches multiple locations', () => {
    const content = 'head\nfoo  \nbar\ntail\nfoo  \nbar\nend'
    const result = applyAiderBlocks(content, [
      { search: 'foo\nbar', replace: 'PATCHED' },
    ])
    expect(result.applied).toBe(1)
    expect(result.matches[0]).toBe('whitespace')
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('matched 2 locations')
    expect(result.warnings[0]).toContain('whitespace-tolerant')
    expect(result.content).toBe('head\nPATCHED\ntail\nfoo  \nbar\nend')
  })

  test('drops a trailing malformed block with no end marker', () => {
    const text = `<<<<<<< SEARCH
foo
=======
bar
>>>>>>> REPLACE
<<<<<<< SEARCH
incomplete
=======
no end marker here`
    const blocks = parseAiderBlocks(text)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toEqual({ search: 'foo', replace: 'bar' })
  })
})
