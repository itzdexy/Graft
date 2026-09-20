import { describe, expect, test } from 'bun:test'
import { fuzzyFilter, fuzzyMatch, fuzzyRank, tokenizeQuery } from './fuzzy.js'

describe('tokenizeQuery', () => {
  test('splits on whitespace and lowercases', () => {
    expect(tokenizeQuery('  Claude   OPUS ')).toEqual(['claude', 'opus'])
  })

  test('empty query yields no tokens', () => {
    expect(tokenizeQuery('   ')).toEqual([])
  })
})

describe('fuzzyMatch', () => {
  test('empty query matches everything with zero score', () => {
    expect(fuzzyMatch('anything', '')).toEqual({ score: 0, indices: [] })
  })

  test('returns null when a character is missing', () => {
    expect(fuzzyMatch('claude-opus', 'zzz')).toBeNull()
  })

  test('returns null when only some tokens match', () => {
    expect(fuzzyMatch('claude-opus-4-5', 'claude gemini')).toBeNull()
  })

  test('exact match outscores prefix match', () => {
    const exact = fuzzyMatch('openai', 'openai')!
    const prefix = fuzzyMatch('openai-compatible', 'openai')!
    expect(exact.score).toBeGreaterThan(prefix.score)
  })

  test('prefix outscores mid-string substring', () => {
    const prefix = fuzzyMatch('groq-cloud', 'groq')!
    const middle = fuzzyMatch('cloud-groq-proxy', 'groq')!
    expect(prefix.score).toBeGreaterThan(middle.score)
  })

  test('segment-start substring outscores a mid-segment one', () => {
    const boundary = fuzzyMatch('claude-opus', 'opus')!
    const buried = fuzzyMatch('xclaudeopusx', 'opus')!
    expect(boundary.score).toBeGreaterThan(buried.score)
  })

  test('subsequence across segment starts still matches', () => {
    expect(fuzzyMatch('claude-opus-4-5', 'copus')).not.toBeNull()
    expect(fuzzyMatch('openai/gpt-5', 'gpt5')).not.toBeNull()
    expect(fuzzyMatch('claude-sonnet-5', 'cs5')).not.toBeNull()
  })

  test('rejects a subsequence whose runs start mid-segment', () => {
    // o·p in anthro(p)ic, u in cla(u)de, s in (s)onnet — an accident, not a match.
    expect(fuzzyMatch('anthropic/claude-sonnet-5', 'opus')).toBeNull()
  })

  test('reports highlight indices for a substring hit', () => {
    expect(fuzzyMatch('claude-opus', 'opus')!.indices).toEqual([7, 8, 9, 10])
  })

  test('multi-token query sums and dedupes indices', () => {
    const match = fuzzyMatch('anthropic/claude-opus-4-5', 'claude opus')!
    expect(match.indices).toEqual([...match.indices].sort((a, b) => a - b))
    expect(new Set(match.indices).size).toBe(match.indices.length)
  })

  test('a token longer than the haystack cannot match', () => {
    expect(fuzzyMatch('gpt', 'gpt-5-turbo-preview')).toBeNull()
  })
})

describe('fuzzyRank', () => {
  const models = [
    'anthropic/claude-sonnet-5',
    'anthropic/claude-opus-4-5-20251101',
    'openai/gpt-5',
    'google/gemini-3-pro',
    'groq/llama-3-70b',
  ]
  const fields = (id: string) => [id]

  test('empty query preserves input order and keeps everything', () => {
    expect(fuzzyRank(models, '', fields).map(r => r.item)).toEqual(models)
  })

  test('filters out non-matches', () => {
    expect(fuzzyFilter(models, 'gemini', fields)).toEqual([
      'google/gemini-3-pro',
    ])
  })

  test('two-token query narrows to the intersection', () => {
    expect(fuzzyFilter(models, 'claude opus', fields)).toEqual([
      'anthropic/claude-opus-4-5-20251101',
    ])
  })

  test('ranks the tighter match first', () => {
    const ranked = fuzzyFilter(models, 'claude', fields)
    expect(ranked).toEqual([
      'anthropic/claude-sonnet-5',
      'anthropic/claude-opus-4-5-20251101',
    ])
  })

  test('a label match outranks a lower-weighted id match', () => {
    type Row = { label: string; id: string }
    const rows: Row[] = [
      { label: 'Fireworks', id: 'fireworks' },
      { label: 'Together AI', id: 'together-fire' },
    ]
    const ranked = fuzzyRank(rows, 'fire', row => [
      { text: row.label, weight: 1 },
      { text: row.id, weight: 0.6 },
    ])
    expect(ranked[0]!.item.label).toBe('Fireworks')
  })

  test('highlight indices come from the flagged field', () => {
    type Row = { label: string; id: string }
    const rows: Row[] = [{ label: 'Claude Opus', id: 'claude-opus-4-5' }]
    const ranked = fuzzyRank(rows, 'opus', row => [
      { text: row.label, highlight: true },
      { text: row.id },
    ])
    // "Claude Opus" — the O of Opus is index 7.
    expect(ranked[0]!.indices).toEqual([7, 8, 9, 10])
  })

  test('ties keep the caller ordering', () => {
    const ranked = fuzzyRank(['ab', 'ab', 'ab'], '', fields)
    expect(ranked).toHaveLength(3)
    expect(ranked.every(r => r.score === 0)).toBe(true)
  })
})
