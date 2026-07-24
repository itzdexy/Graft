import { describe, expect, test } from 'bun:test'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  enrichBlinkPrompt,
  extractUrlsFromText,
  formatEnrichmentBanner,
} from './enrich.js'

describe('extractUrlsFromText', () => {
  test('deduplicates and strips trailing punctuation', () => {
    const urls = extractUrlsFromText(
      'See https://example.com/a. Also https://example.com/a and https://foo.bar/b;',
    )
    expect(urls).toEqual(['https://example.com/a', 'https://foo.bar/b'])
  })

  test('returns empty for text without URLs', () => {
    expect(extractUrlsFromText('no links here')).toEqual([])
  })
})

describe('formatEnrichmentBanner', () => {
  test('joins notes with middle dot', () => {
    expect(formatEnrichmentBanner(['a', 'b'])).toBe('Ecosystem: a · b')
  })

  test('returns null for empty notes', () => {
    expect(formatEnrichmentBanner([])).toBeNull()
  })
})

describe('enrichBlinkPrompt', () => {
  test('flags URLs in goals', () => {
    const { blocks, notes } = enrichBlinkPrompt(
      'read https://example.com/docs please',
      '/tmp',
    )
    expect(blocks.length).toBeGreaterThan(0)
    expect(notes.some(n => n.includes('URL'))).toBe(true)
    const text = blocks.map(b => (b.type === 'text' ? b.text : '')).join('\n')
    expect(text).toContain('https://example.com/docs')
    expect(text).toContain('WebFetch')
  })

  test('skips URL block when more than five URLs', () => {
    const many =
      'https://a.com/1 https://b.com/2 https://c.com/3 https://d.com/4 https://e.com/5 https://f.com/6'
    const { notes } = enrichBlinkPrompt(many, '/tmp')
    expect(notes.some(n => n.includes('URL'))).toBe(false)
  })

  test('expands @file mentions', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'blink-enrich-'))
    const f = join(cwd, 'bar.ts')
    writeFileSync(f, 'export const answer = 42')
    const { blocks, notes } = enrichBlinkPrompt('fix @bar.ts', cwd)
    expect(notes.some(n => n.includes('@file'))).toBe(true)
    const text = blocks.map(b => (b.type === 'text' ? b.text : '')).join('\n')
    expect(text).toContain('Attached @file context')
    expect(text).toContain('answer')
  })

  test('parses multi-line warp command blocks', () => {
    const paste = 'npm test\necho done\necho ok\n\ngit status'
    const { blocks, notes } = enrichBlinkPrompt(paste, '/tmp')
    expect(notes.some(n => n.includes('Warp'))).toBe(true)
    const text = blocks.map(b => (b.type === 'text' ? b.text : '')).join('\n')
    expect(text).toContain('Multi-command paste')
    expect(text).toContain('npm test')
  })

  test('prepends OpenHands resolver for a single GitHub issue URL', () => {
    const goal =
      'fix https://github.com/acme/widgets/issues/42 before release'
    const { blocks, notes } = enrichBlinkPrompt(goal, '/tmp')
    expect(notes).toContain('OpenHands issue resolver prepended')
    const text = blocks.map(b => (b.type === 'text' ? b.text : '')).join('\n')
    expect(text).toContain('acme/widgets')
    expect(text).toContain('#42')
  })

  test('does not prepend OpenHands when multiple issue URLs', () => {
    const goal =
      'https://github.com/a/b/issues/1 and https://github.com/c/d/issues/2'
    const { notes } = enrichBlinkPrompt(goal, '/tmp')
    expect(notes.some(n => n.includes('OpenHands'))).toBe(false)
  })
})
