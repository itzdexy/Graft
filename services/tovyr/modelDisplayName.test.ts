import { describe, expect, test } from 'bun:test'
import { formatProviderModelDisplayName } from '../../scripts/tovyr-model-display.js'

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
        label: 'Tovyr Sonnet 5',
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
})
