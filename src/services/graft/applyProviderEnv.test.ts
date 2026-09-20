import { describe, expect, test } from 'bun:test'
import { buildDirectAnthropicEnvPatch } from './applyProviderEnv.js'

describe('buildDirectGraftEnvPatch', () => {
  test('api key mode sets ANTHROPIC_API_KEY', () => {
    const patch = buildDirectAnthropicEnvPatch({
      providerId: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-test',
      model: 'claude-sonnet-4-20250514',
    })
    expect(patch.ANTHROPIC_API_KEY).toBe('sk-test')
    expect(patch.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(patch.ANTHROPIC_BASE_URL).toBe('https://api.anthropic.com')
    expect(patch.ANTHROPIC_MODEL).toBe('claude-sonnet-4-20250514')
    expect(patch.ANTHROPIC_DEFAULT_SONNET_MODEL).toBeUndefined()
  })

  test('auth token mode sets ANTHROPIC_AUTH_TOKEN and clears API key', () => {
    const patch = buildDirectAnthropicEnvPatch({
      providerId: 'custom',
      baseUrl: 'https://gateway.example/v1',
      apiKey: 'tok_abc',
      authMode: 'authToken',
    })
    expect(patch.ANTHROPIC_AUTH_TOKEN).toBe('tok_abc')
    expect(patch.ANTHROPIC_API_KEY).toBe('')
    expect(patch.ANTHROPIC_MODEL).toBeUndefined()
  })

  test('OAuth mode leaves credentials to Graft secure storage', () => {
    const patch = buildDirectAnthropicEnvPatch({
      providerId: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      apiKey: '',
      authMode: 'oauth',
      model: 'claude-sonnet-4-20250514',
    })
    expect(patch.ANTHROPIC_API_KEY).toBeUndefined()
    expect(patch.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    expect(patch.ANTHROPIC_MODEL).toBe('claude-sonnet-4-20250514')
    expect(patch.GRAFT_ACTIVE_PROVIDER).toBe('anthropic')
    expect(patch.GRAFT_PROVIDER_AUTH_MODE).toBe('oauth')
  })

  test('Meta Model API uses Bearer auth against api.meta.ai', () => {
    const patch = buildDirectAnthropicEnvPatch({
      providerId: 'meta',
      baseUrl: 'https://api.meta.ai',
      apiKey: 'model-api-key-example-token-value',
      authMode: 'authToken',
      model: 'muse-spark-1.3-contributor',
    })
    expect(patch.ANTHROPIC_BASE_URL).toBe('https://api.meta.ai')
    expect(patch.ANTHROPIC_AUTH_TOKEN).toBe('model-api-key-example-token-value')
    expect(patch.ANTHROPIC_API_KEY).toBe('')
    expect(patch.ANTHROPIC_MODEL).toBe('muse-spark-1.3-contributor')
    expect(patch.GRAFT_ACTIVE_PROVIDER).toBe('meta')
  })

  test('strips a leftover /v1 from a previous Meta OpenAI-compat catalog entry', () => {
    const patch = buildDirectAnthropicEnvPatch({
      providerId: 'meta',
      baseUrl: 'https://api.meta.ai/v1',
      apiKey: 'model-api-key-example-token-value',
      authMode: 'authToken',
      model: 'muse-spark-1.3',
    })
    expect(patch.ANTHROPIC_BASE_URL).toBe('https://api.meta.ai')
  })
})
