import { describe, expect, test } from 'bun:test'
import { buildDirectAnthropicEnvPatch } from './applyProviderEnv.js'

describe('buildDirectTovyrEnvPatch', () => {
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

  test('OAuth mode leaves credentials to Tovyr secure storage', () => {
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
    expect(patch.TOVYR_ACTIVE_PROVIDER).toBe('anthropic')
    expect(patch.TOVYR_PROVIDER_AUTH_MODE).toBe('oauth')
  })
})
