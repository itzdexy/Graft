import { describe, expect, test } from 'bun:test'
import {
  formatSearchSummary,
  qualifiedModelId,
  searchModels,
  searchProviders,
  shouldOfferCustomModelId,
  type ModelSearchRow,
  type ProviderSearchRow,
} from './pickerSearch.js'

function provider(
  id: string,
  label: string,
  overrides: Partial<ProviderSearchRow> = {},
): ProviderSearchRow {
  return {
    id,
    label,
    category: 'api',
    categoryLabel: 'Direct APIs',
    connected: false,
    local: false,
    active: false,
    ...overrides,
  }
}

const PROVIDERS: ProviderSearchRow[] = [
  provider('anthropic', 'Anthropic', { category: 'direct' }),
  provider('openai', 'OpenAI'),
  provider('openrouter', 'OpenRouter', {
    category: 'gateway',
    categoryLabel: 'Gateways',
    anyModel: true,
  }),
  provider('google', 'Google AI Studio'),
  provider('groq', 'Groq'),
  provider('ollama', 'Ollama', {
    category: 'self_hosted',
    categoryLabel: 'Self-hosted',
    local: true,
    connected: true,
  }),
]

function ids(rows: { item: { id: string } }[]): string[] {
  return rows.map(r => r.item.id)
}

describe('searchProviders', () => {
  test('empty query returns every provider in input order', () => {
    expect(ids(searchProviders(PROVIDERS, ''))).toEqual([
      'anthropic',
      'openai',
      'openrouter',
      'google',
      'groq',
      'ollama',
    ])
  })

  test('exact provider id ranks first', () => {
    expect(ids(searchProviders(PROVIDERS, 'openai'))[0]).toBe('openai')
  })

  test('prefix query keeps both openai and openrouter, openai first', () => {
    expect(ids(searchProviders(PROVIDERS, 'open'))).toEqual([
      'openai',
      'openrouter',
    ])
  })

  test('nickname finds the provider that serves it', () => {
    expect(ids(searchProviders(PROVIDERS, 'claude'))).toEqual(['anthropic'])
    expect(ids(searchProviders(PROVIDERS, 'chatgpt'))).toEqual(['openai'])
    expect(ids(searchProviders(PROVIDERS, 'gemini'))).toEqual(['google'])
  })

  test('matches on the human label, not just the id', () => {
    expect(ids(searchProviders(PROVIDERS, 'studio'))).toEqual(['google'])
  })

  test('category name is searchable', () => {
    expect(ids(searchProviders(PROVIDERS, 'gateway'))).toEqual(['openrouter'])
  })

  test('a query that matches nothing returns an empty list', () => {
    expect(searchProviders(PROVIDERS, 'zzzznope')).toEqual([])
  })

  test('case is ignored', () => {
    expect(ids(searchProviders(PROVIDERS, 'GROQ'))).toEqual(['groq'])
  })

  test('catalog hints answer "who serves this?" in provider search', () => {
    // Ollama also contains the literal substring "llama"; the hint match on
    // Groq is the stronger one and must sort first.
    expect(ids(searchProviders(PROVIDERS, 'llama'))[0]).toBe('groq')
    expect(ids(searchProviders(PROVIDERS, 'offline'))).toEqual(['ollama'])
  })
})

function model(
  providerId: string,
  modelId: string,
  label: string,
  overrides: Partial<ModelSearchRow> = {},
): ModelSearchRow {
  return {
    providerId,
    providerLabel: providerId === 'anthropic' ? 'Anthropic' : providerId,
    modelId,
    label,
    tier: 'sonnet',
    tierLabel: 'Balanced',
    ...overrides,
  }
}

const MODELS: ModelSearchRow[] = [
  model('anthropic', 'claude-opus-4-5-20251101', 'Claude Opus 4.5', {
    tier: 'opus',
    tierLabel: 'Best',
  }),
  model('anthropic', 'claude-sonnet-5', 'Claude Sonnet 5'),
  model('anthropic', 'claude-haiku-4-5-20251001', 'Claude Haiku 4.5', {
    tier: 'haiku',
    tierLabel: 'Fast',
  }),
  model('openai', 'gpt-5', 'GPT-5', { providerLabel: 'OpenAI' }),
  model('openai', 'o3-mini', 'o3 mini', { providerLabel: 'OpenAI' }),
  model('google', 'gemini-3-pro', 'Gemini 3 Pro', { providerLabel: 'Google' }),
  model('groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B', {
    providerLabel: 'Groq',
  }),
]

function modelIds(rows: { item: ModelSearchRow }[]): string[] {
  return rows.map(r => r.item.modelId)
}

describe('searchModels', () => {
  test('empty query returns everything in input order', () => {
    expect(modelIds(searchModels(MODELS, ''))).toHaveLength(MODELS.length)
  })

  test('finds by display label', () => {
    expect(modelIds(searchModels(MODELS, 'opus'))).toEqual([
      'claude-opus-4-5-20251101',
    ])
  })

  test('finds by bare model id', () => {
    expect(modelIds(searchModels(MODELS, 'gpt-5'))).toEqual(['gpt-5'])
  })

  test('finds by qualified provider/model id', () => {
    expect(modelIds(searchModels(MODELS, 'anthropic/sonnet'))).toEqual([
      'claude-sonnet-5',
    ])
  })

  test('finds by provider nickname across providers', () => {
    expect(modelIds(searchModels(MODELS, 'gemini'))).toEqual(['gemini-3-pro'])
  })

  test('provider name alone lists that providers models', () => {
    expect(modelIds(searchModels(MODELS, 'openai')).sort()).toEqual([
      'gpt-5',
      'o3-mini',
    ])
  })

  test('two-token query narrows across label and provider', () => {
    expect(modelIds(searchModels(MODELS, 'claude haiku'))).toEqual([
      'claude-haiku-4-5-20251001',
    ])
  })

  test('abbreviation across segments still matches', () => {
    expect(modelIds(searchModels(MODELS, 'gpt5'))).toEqual(['gpt-5'])
  })

  test('the human tier label is searchable, the raw tier id is not', () => {
    expect(modelIds(searchModels(MODELS, 'Best'))).toEqual([
      'claude-opus-4-5-20251101',
    ])
    // "sonnet" is a tier id on every row; it must only match the Claude one.
    expect(modelIds(searchModels(MODELS, 'sonnet'))).toEqual([
      'claude-sonnet-5',
    ])
  })

  test('a nonsense query returns nothing rather than everything', () => {
    expect(searchModels(MODELS, 'qqqqzz')).toEqual([])
  })

  test('partial date suffix still resolves the dated id', () => {
    expect(modelIds(searchModels(MODELS, '20251101'))).toEqual([
      'claude-opus-4-5-20251101',
    ])
  })

  test('provider catalog hints do not leak into model search', () => {
    // "opus" is a hint for the Anthropic *provider*; folding it into model
    // search would make every Anthropic model match the query "opus".
    expect(modelIds(searchModels(MODELS, 'opus'))).toEqual([
      'claude-opus-4-5-20251101',
    ])
    expect(modelIds(searchModels(MODELS, 'sonnet'))).toEqual([
      'claude-sonnet-5',
    ])
  })

  test('brand nicknames still reach every model of that provider', () => {
    expect(modelIds(searchModels(MODELS, 'claude'))).toHaveLength(3)
  })
})

describe('qualifiedModelId', () => {
  test('joins provider and model', () => {
    expect(qualifiedModelId({ providerId: 'openai', modelId: 'gpt-5' })).toBe(
      'openai/gpt-5',
    )
  })

  test('does not repeat a provider the id already names', () => {
    expect(
      qualifiedModelId({ providerId: 'openai', modelId: 'openai/gpt-5.5' }),
    ).toBe('openai/gpt-5.5')
  })

  test('keeps a gateways upstream namespace', () => {
    expect(
      qualifiedModelId({
        providerId: 'openrouter',
        modelId: 'anthropic/claude-haiku-4-5',
      }),
    ).toBe('openrouter/anthropic/claude-haiku-4-5')
  })

  test('matches the provider prefix case-insensitively', () => {
    expect(
      qualifiedModelId({ providerId: 'openai', modelId: 'OpenAI/gpt-5' }),
    ).toBe('OpenAI/gpt-5')
  })
})

describe('shouldOfferCustomModelId', () => {
  const matches = [model('openrouter', 'gpt-5', 'GPT-5')]

  test('offers an unknown id on an any-model provider', () => {
    expect(
      shouldOfferCustomModelId({
        query: 'some-brand-new-model',
        anyModel: true,
        matches: [],
      }),
    ).toBe(true)
  })

  test('does not offer when the provider has a fixed catalog', () => {
    expect(
      shouldOfferCustomModelId({
        query: 'some-brand-new-model',
        anyModel: false,
        matches: [],
      }),
    ).toBe(false)
  })

  test('does not offer an id already in the results', () => {
    expect(
      shouldOfferCustomModelId({ query: 'gpt-5', anyModel: true, matches }),
    ).toBe(false)
  })

  test('does not offer a multi-word query — that is a search, not an id', () => {
    expect(
      shouldOfferCustomModelId({
        query: 'claude opus',
        anyModel: true,
        matches: [],
      }),
    ).toBe(false)
  })

  test('ignores a one-character query', () => {
    expect(
      shouldOfferCustomModelId({ query: 'g', anyModel: true, matches: [] }),
    ).toBe(false)
  })
})

describe('formatSearchSummary', () => {
  test('shows a plain total with no query', () => {
    expect(
      formatSearchSummary({ shown: 83, total: 83, noun: 'provider', query: '' }),
    ).toBe('83 providers')
  })

  test('shows shown-of-total while filtering', () => {
    expect(
      formatSearchSummary({
        shown: 3,
        total: 308,
        noun: 'model',
        query: 'opus',
      }),
    ).toBe('3 of 308 models')
  })

  test('appends the provider count when given', () => {
    expect(
      formatSearchSummary({
        shown: 12,
        total: 308,
        noun: 'model',
        query: 'claude',
        providerCount: 4,
      }),
    ).toBe('12 of 308 models · 4 providers')
  })

  test('singularizes a lone result', () => {
    expect(
      formatSearchSummary({ shown: 1, total: 1, noun: 'provider', query: '' }),
    ).toBe('1 provider')
  })
})
