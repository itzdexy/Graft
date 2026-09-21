import { expect, test } from 'bun:test'
import { PROVIDER_CATALOG } from './graft-provider-catalog.js'
import { NEW_PROVIDERS, PROVIDER_UPDATES } from './graft-provider-updates.js'
import { providerNeedsOpenAiCompat, openAiChatCompletionsUrl } from './graft-provider-upstream.js'
import { getProvider, resolveActive, resolveProviderSelection, listProviderIds } from './graft-providers.js'

test('reviewed direct endpoints and new providers use the compatible transport', () => {
  for (const [id, entry] of Object.entries({ ...PROVIDER_UPDATES, ...NEW_PROVIDERS })) {
    if (!('apiFormat' in entry)) continue
    const provider = PROVIDER_CATALOG[id]!
    expect(providerNeedsOpenAiCompat(provider)).toBe(true)
    expect(provider.authMode).toBe('authToken')
    expect(openAiChatCompletionsUrl(provider.baseUrl)).toBe(entry.baseUrl + '/chat/completions')
  }
  expect(PROVIDER_CATALOG.openai.models.some(m => m.id === 'gpt-6-astra')).toBe(true)
  expect(PROVIDER_CATALOG.anthropic.models.some(m => m.id === 'claude-fable-5-1')).toBe(true)
  expect(PROVIDER_CATALOG.google.models.some(m => m.id === 'gemini-3.8-flash')).toBe(true)
})

test('catalog updates preserve explicit endpoint overrides', () => {
  const state = { endpoints: { groq: 'https://my-gateway.invalid/v1' } } as never
  expect(getProvider('groq', state)?.baseUrl).toBe('https://my-gateway.invalid/v1')
})

test('retired services cannot be selected even with saved credentials', () => {
  const state = { active: 'github_models', keys: { github_models: 'fixture-only-key' }, models: { github_models: 'old-model' } } as never
  expect(listProviderIds()).not.toContain('github_models')
  expect(resolveActive(state)).toBeNull()
  expect(resolveProviderSelection('github_models', 'old-model', state)).toBeNull()
})
