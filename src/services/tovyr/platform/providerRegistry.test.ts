import { describe, expect, test } from 'bun:test'
import { parseQualifiedModel, qualifyModel, listConnectedPlatformModels, listPlatformModels, resolvePlatformSelection } from './providerRegistry.js'

describe('platform provider registry facade', () => {
  test('parses and qualifies provider-scoped model ids', () => {
    expect(parseQualifiedModel('ollama::qwen2.5-coder:1.5b')).toEqual({ providerId: 'ollama', modelId: 'qwen2.5-coder:1.5b' })
    expect(parseQualifiedModel('plain-model')).toEqual({ modelId: 'plain-model' })
    expect(qualifyModel('ollama', 'qwen2.5-coder:1.5b')).toBe('ollama::qwen2.5-coder:1.5b')
  })

  test('lists qualified catalog models without exposing credentials', () => {
    const models = listPlatformModels('ollama')
    expect(models.every(model => model.id.startsWith('ollama::'))).toBe(true)
    expect(JSON.stringify(models)).not.toContain('apiKey')
  })

  test('resolves a local provider selection through the existing state store', () => {
    const selection = resolvePlatformSelection('ollama', 'qwen2.5-coder:1.5b')
    expect(selection?.providerId).toBe('ollama')
    expect(selection?.protocol).toBe('openai')
  })

  test('limits integration catalogs to configured providers', () => {
    const models = listConnectedPlatformModels({
      active: 'openrouter',
      keys: { openrouter: 'sk-or-v1-test-key-12345678' },
      models: {},
      auth: {},
      custom: { baseUrl: '' },
      endpoints: {},
    })
    expect(models.length).toBeGreaterThan(0)
    expect(models.every(model => !model.id.startsWith('ollama::'))).toBe(true)
  })
})
