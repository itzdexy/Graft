import { describe, expect, test } from 'bun:test'
import {
  parseOpenAiModelsList,
  resetProviderModelCache,
} from './providerModels.js'

describe('parseOpenAiModelsList', () => {
  test('extracts ids from OpenAI models list shape', () => {
    const ids = parseOpenAiModelsList({
      data: [{ id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
    })
    expect(ids).toEqual(['gpt-4o', 'gpt-4o-mini'])
  })

  test('deduplicates duplicate model ids from API', () => {
    const ids = parseOpenAiModelsList({
      data: [{ id: 'gpt-4o' }, { id: 'gpt-4o' }, { id: 'gpt-4o-mini' }],
    })
    expect(ids).toEqual(['gpt-4o', 'gpt-4o-mini'])
  })

  test('skips entries without string id', () => {
    const ids = parseOpenAiModelsList({
      data: [{ id: 'ok' }, { name: 'bad' }, null, { id: 1 }],
    })
    expect(ids).toEqual(['ok'])
  })

  test('returns empty for malformed payload', () => {
    expect(parseOpenAiModelsList(null)).toEqual([])
    expect(parseOpenAiModelsList({})).toEqual([])
    expect(parseOpenAiModelsList({ data: 'nope' })).toEqual([])
  })
})

describe('resetProviderModelCache', () => {
  test('does not throw', () => {
    resetProviderModelCache()
    expect(true).toBe(true)
  })
})