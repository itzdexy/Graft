import { describe, expect, test } from 'bun:test'
import { PROVIDER_CATALOG } from '../../../scripts/graft-provider-catalog.js'
import { formatProviderModelDisplayName } from '../../../scripts/graft-model-display.js'
import { GRAFT_MODEL_REGISTRY } from './models/registry.data.js'

describe('formatProviderModelDisplayName', () => {
  test('restores Claude identity when a catalog label omits or replaces it', () => {
    expect(
      formatProviderModelDisplayName({
        providerId: 'anthropic',
        modelId: 'claude-opus-5',
        label: 'Opus 5',
      }),
    ).toBe('Claude Opus 5')

    expect(
      formatProviderModelDisplayName({
        providerId: 'openrouter',
        modelId: 'anthropic/claude-sonnet-5',
        label: 'Graft Sonnet 5',
      }),
    ).toBe('Claude Sonnet 5')
  })

  test('preserves already-correct Claude labels', () => {
    expect(
      formatProviderModelDisplayName({
        providerId: 'freemodel',
        modelId: 'claude-haiku-4-5',
        label: 'Claude Haiku 4.5',
      }),
    ).toBe('Claude Haiku 4.5')
  })

  test('leaves other vendors and wire model ids unchanged', () => {
    const modelId = 'openai/gpt-5.6-sol'

    expect(
      formatProviderModelDisplayName({
        providerId: 'openrouter',
        modelId,
        label: 'GPT-5.6 Sol',
      }),
    ).toBe('GPT-5.6 Sol')
    expect(modelId).toBe('openai/gpt-5.6-sol')
  })

  test('ships provider-correct Claude labels in the provider catalog', () => {
    const mislabeled = Object.values(PROVIDER_CATALOG).flatMap(provider =>
      (provider.models ?? [])
        .filter(model => /claude/i.test(model.id))
        .filter(model => !/^Claude\b/.test(model.label))
        .map(model => `${provider.id}:${model.id}=${model.label}`),
    )

    expect(mislabeled).toEqual([])
  })

  test('ships provider-correct Claude labels in the typed registry', () => {
    const mislabeled = GRAFT_MODEL_REGISTRY.filter(entry =>
      /claude/i.test(entry.upstreamModelId),
    )
      .filter(entry => !/^Claude\b/.test(entry.displayName))
      .map(entry => `${entry.upstreamModelId}=${entry.displayName}`)

    expect(mislabeled).toEqual([])
    expect(
      GRAFT_MODEL_REGISTRY.find(
        entry => entry.upstreamModelId === 'claude-opus-5',
      )?.displayName,
    ).toBe('Claude Opus 5')
  })
})
