import { describe, expect, test } from 'bun:test'
import {
  pickBestCatalogModel,
  pickBestProviderModel,
  pickBestVerifiedModel,
} from './providerModelPick.js'

describe('pickBestVerifiedModel', () => {
  test('prefers catalog default when verified', () => {
    const picked = pickBestVerifiedModel('openrouter', [
      'meta-llama/llama-3-8b',
      'anthropic/claude-3.5-sonnet',
    ])
    expect(picked).toBeTruthy()
    expect(['meta-llama/llama-3-8b', 'anthropic/claude-3.5-sonnet']).toContain(
      picked!,
    )
  })

  test('skips excluded models', () => {
    const verified = ['model-a', 'model-b', 'model-c']
    const picked = pickBestVerifiedModel(
      'openrouter',
      verified,
      new Set(['model-a', 'model-b']),
    )
    expect(picked).toBe('model-c')
  })

  test('skips unsuitable API remainder like codellama and embeds', () => {
    const picked = pickBestVerifiedModel('nvidia_nim', [
      'codellama',
      'nv-embedqa-e5-v5',
      'meta/llama-3.1-8b-instruct',
    ])
    expect(picked).toBe('meta/llama-3.1-8b-instruct')
  })

  test('returns null when only unsuitable models are verified', () => {
    expect(
      pickBestVerifiedModel('nvidia_nim', ['codellama', 'nv-embedqa-e5-v5']),
    ).toBeNull()
  })

  test('returns null when nothing verified', () => {
    expect(pickBestVerifiedModel('openrouter', [])).toBeNull()
  })

  test('allows catalog Graft models on OpenRouter', () => {
    const picked = pickBestVerifiedModel('openrouter', [
      'claude-3-5-sonnet-20241022',
      'meta-llama/llama-3-8b',
      'anthropic/claude-sonnet',
    ])
    expect(picked).toBe('anthropic/claude-sonnet')
  })

  test('accepts non-catalog Claude IDs when the gateway explicitly lists them', () => {
    const picked = pickBestVerifiedModel('openrouter', [
      'claude-3-5-sonnet-20241022',
      'meta-llama/llama-3-8b',
    ])
    expect(picked).toBe('claude-3-5-sonnet-20241022')
  })
})

describe('pickBestCatalogModel', () => {
  test('returns openrouter default when verified list is empty', () => {
    const picked = pickBestCatalogModel('openrouter')
    expect(picked).toBe('anthropic/claude-sonnet-5')
  })
})

describe('pickBestProviderModel', () => {
  test('falls back to catalog when verified is empty', () => {
    const picked = pickBestProviderModel('openrouter', [])
    expect(picked).toBe('anthropic/claude-sonnet-5')
  })
})
