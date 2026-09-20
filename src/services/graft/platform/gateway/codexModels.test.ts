import { describe, expect, test } from 'bun:test'
import { toCodexModelInfo, toCodexModelsResponse } from './codexModels.js'

describe('Codex model catalog adapter', () => {
  test('emits qualified model ids and the metadata Codex requires', () => {
    const model = toCodexModelInfo({
      id: 'openrouter::anthropic/claude-sonnet-4',
      displayName: 'Claude Sonnet 4',
      available: true,
      contextTokens: 200_000,
      maxOutputTokens: null,
      supportsTools: true,
      supportsVision: true,
      supportsReasoning: true,
      supportsStreaming: true,
      lifecycle: 'active',
      source: 'provider',
    })

    expect(model.slug).toBe('openrouter::anthropic/claude-sonnet-4')
    expect(model.supported_reasoning_levels).toHaveLength(4)
    expect(model.base_instructions).toBeString()
    expect(model.truncation_policy).toEqual({ mode: 'tokens', limit: 10_000 })
    expect(model.input_modalities).toEqual(['text', 'image'])
  })

  test('keeps the public OpenAI list alongside Codex metadata', () => {
    const response = toCodexModelsResponse([
      {
        id: 'nvidia_nim::moonshotai/kimi-k3',
        displayName: 'Kimi K3',
        available: true,
        contextTokens: null,
        maxOutputTokens: null,
        supportsTools: null,
        supportsVision: false,
        supportsReasoning: false,
        supportsStreaming: true,
        lifecycle: 'active',
        source: 'catalog',
      },
    ])

    expect(response.models).toHaveLength(1)
    expect(response.data).toEqual([{ id: 'nvidia_nim::moonshotai/kimi-k3', object: 'model', owned_by: 'nvidia_nim' }])
  })
})
