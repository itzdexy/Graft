import { describe, expect, test } from 'bun:test'
import {
  humanizeOpenAiModelId,
  inferModelTier,
  resolveProviderModelsForPicker,
} from './catalogModels.js'

describe('humanizeOpenAiModelId', () => {
  test('formats vendor/model slugs', () => {
    expect(humanizeOpenAiModelId('meta/llama-3.1-70b-instruct')).toBe(
      'Llama 3.1 70b Instruct',
    )
  })
})

describe('inferModelTier', () => {
  test('classifies small models as haiku', () => {
    expect(inferModelTier('meta/llama-3.2-3b-instruct')).toBe('haiku')
  })

  test('classifies large models as opus', () => {
    expect(inferModelTier('meta/llama-3.1-70b-instruct')).toBe('opus')
  })
})

describe('resolveProviderModelsForPicker', () => {
  const nvidia = {
    id: 'nvidia_nim',
    apiFormat: 'openai' as const,
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: [
      { id: 'meta/llama-3.1-70b-instruct', label: 'Llama 3.1 70B', tier: 'opus' as const },
      { id: 'mistralai/mistral-large', label: 'Mistral Large', tier: 'opus' as const },
    ],
  }

  test('filters active OpenAI-compat provider to verified ids only', () => {
    const verified = new Set([
      'meta/llama-3.1-70b-instruct',
      'deepseek-ai/deepseek-r1',
    ])
    const models = resolveProviderModelsForPicker(nvidia, verified, {
      providerId: 'nvidia_nim',
      isActiveProvider: true,
    })
    expect(models.map(m => m.id).sort()).toEqual(
      ['deepseek-ai/deepseek-r1', 'meta/llama-3.1-70b-instruct'].sort(),
    )
    expect(models.find(m => m.id === 'deepseek-ai/deepseek-r1')?.label).toBe(
      'Deepseek R1',
    )
  })

  test('keeps full catalog for inactive providers', () => {
    const verified = new Set(['meta/llama-3.1-70b-instruct'])
    const models = resolveProviderModelsForPicker(nvidia, verified, {
      providerId: 'nvidia_nim',
      isActiveProvider: false,
    })
    expect(models).toHaveLength(2)
  })

  test('keeps full catalog when verified list is empty', () => {
    const models = resolveProviderModelsForPicker(nvidia, new Set(), {
      providerId: 'nvidia_nim',
      isActiveProvider: true,
    })
    expect(models).toHaveLength(2)
  })
})
