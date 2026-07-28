import { describe, expect, test } from 'bun:test'
import { isLocalProvider, isLocalProviderId } from './tovyr-provider-local.js'
import { getProvider, resolveActive } from './tovyr-providers.js'
import { providerNeedsOpenAiCompat } from './tovyr-provider-upstream.js'

describe('local providers', () => {
  test('ollama and lmstudio are registered in catalog', () => {
    expect(getProvider('ollama')?.apiFormat).toBe('openai')
    expect(getProvider('lmstudio')?.apiFormat).toBe('openai')
    expect(isLocalProviderId('ollama')).toBe(true)
    expect(isLocalProviderId('lmstudio')).toBe(true)
  })

  test('local providers use OpenAI-compat proxy routing', () => {
    expect(providerNeedsOpenAiCompat(getProvider('ollama'))).toBe(true)
    expect(providerNeedsOpenAiCompat(getProvider('lmstudio'))).toBe(true)
    expect(providerNeedsOpenAiCompat(getProvider('openai'))).toBe(true)
  })

  test('resolveActive works for ollama without saved key', () => {
    const state = {
      active: 'ollama',
      keys: {},
      models: { ollama: 'llama3.2' },
      custom: { baseUrl: '' },
      endpoints: {},
    }
    const active = resolveActive(state)
    expect(active?.providerId).toBe('ollama')
    expect(active?.apiKey).toBe('local-only')
    expect(isLocalProvider(getProvider('ollama'))).toBe(true)
  })
})
