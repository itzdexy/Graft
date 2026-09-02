import { describe, expect, test } from 'bun:test'
import { resolveProviderSelection } from '../../../../scripts/tovyr-providers.js'

describe('resolveProviderSelection', () => {
  test('resolves a candidate without changing active provider or saved models', () => {
    const state = {
      active: 'anthropic',
      keys: { anthropic: 'sk-ant-test-key-that-is-long-enough' },
      models: { anthropic: 'claude-sonnet-5' },
      auth: {},
      custom: { baseUrl: '' },
      endpoints: {},
    }
    const before = structuredClone(state)

    const candidate = resolveProviderSelection(
      'anthropic',
      'claude-opus-4-8',
      state,
    )

    expect(candidate).toMatchObject({
      providerId: 'anthropic',
      model: 'claude-opus-4-8',
    })
    expect(state).toEqual(before)
  })
})
