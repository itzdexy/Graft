import { describe, expect, test } from 'bun:test'
import {
  humanizeOpenAiModelId,
  inferModelTier,
  resolveProviderModelsForPicker,
} from './catalogModels.js'
import { markProviderModelUnavailable, resetProviderModelAvailability } from './modelAvailability.js'

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
    expect(inferModelTier('muse-spark-1.3')).toBe('opus')
    expect(inferModelTier('llama-4-maverick-17b-128e')).toBe('opus')
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

  test('NIM lists curated models first, then every other live model', () => {
    const verified = new Set([
      'meta/llama-3.1-70b-instruct',
      'deepseek-ai/deepseek-r1',
      'nv-embedqa-e5-v5',
      'codellama',
    ])
    const models = resolveProviderModelsForPicker(nvidia, verified, {
      providerId: 'nvidia_nim',
      isActiveProvider: true,
    })
    const ids = models.map(m => m.id)
    // Curated recommendation leads.
    expect(ids[0]).toBe('meta/llama-3.1-70b-instruct')
    // But a live model absent from the curated list must still be selectable;
    // hiding it forced users to type the id by hand as a custom model.
    expect(ids).toContain('deepseek-ai/deepseek-r1')
    // Embedding models are not agent chat targets, but they are no longer
    // hidden: they sort last and buildModelPickerRows marks them
    // unselectable. Dropping them outright meant a user searching for one
    // was told it did not exist.
    expect(ids).toContain('nv-embedqa-e5-v5')
    expect(ids.indexOf('nv-embedqa-e5-v5')).toBeGreaterThan(
      ids.indexOf('deepseek-ai/deepseek-r1'),
    )
  })

  test('lists live models even when no catalog id is live, chat targets first', () => {
    const verified = new Set([
      'meta/llama-3.3-70b-instruct',
      'nv-embedqa-e5-v5',
    ])
    const models = resolveProviderModelsForPicker(nvidia, verified, {
      providerId: 'nvidia_nim',
      isActiveProvider: true,
    })
    expect(models.map(m => m.id)).toEqual([
      'meta/llama-3.3-70b-instruct',
      'nv-embedqa-e5-v5',
    ])
  })

  test('omits unavailable catalog models', () => {
    resetProviderModelAvailability()
    markProviderModelUnavailable(
      'nvidia_nim',
      'meta/llama-3.1-70b-instruct',
      'probe failed',
    )
    const verified = new Set([
      'meta/llama-3.1-70b-instruct',
      'mistralai/mistral-large',
    ])
    const models = resolveProviderModelsForPicker(nvidia, verified, {
      providerId: 'nvidia_nim',
      isActiveProvider: true,
    })
    expect(models.map(m => m.id)).toEqual(['mistralai/mistral-large'])
    resetProviderModelAvailability()
  })

  test('a non-active provider uses its live list too', () => {
    // Live ids used to apply only to the active provider, so every other
    // provider fell back to the static catalog — the "0 of 34 models" bug.
    const verified = new Set(['meta/llama-3.1-70b-instruct'])
    const models = resolveProviderModelsForPicker(nvidia, verified, {
      providerId: 'nvidia_nim',
      isActiveProvider: false,
    })
    expect(models.map(m => m.id)).toEqual(['meta/llama-3.1-70b-instruct'])
  })

  test('a live id missing from the catalog is still offered', () => {
    // stealth/ox-alpha exists on OpenRouter but not in any hand-written list.
    const models = resolveProviderModelsForPicker(
      { id: 'openrouter', apiFormat: 'openai', models: [], anyModel: true },
      new Set(['stealth/ox-alpha']),
      { providerId: 'openrouter' },
    )
    expect(models.map(m => m.id)).toEqual(['stealth/ox-alpha'])
  })

  test('an accepts-array of ids works as well as a Set', () => {
    const models = resolveProviderModelsForPicker(
      nvidia,
      ['mistralai/mistral-large'],
      { providerId: 'nvidia_nim' },
    )
    expect(models.map(m => m.id)).toEqual(['mistralai/mistral-large'])
  })

  test('keeps full catalog when verified list is empty', () => {
    const models = resolveProviderModelsForPicker(nvidia, new Set(), {
      providerId: 'nvidia_nim',
      isActiveProvider: true,
    })
    expect(models).toHaveLength(2)
  })

  test('live provider data also replaces native-provider catalog guesses', () => {
    const anthropic = {
      id: 'anthropic',
      apiFormat: 'anthropic',
      baseUrl: 'https://api.anthropic.com',
      models: [
        { id: 'claude-old', label: 'Old catalog model', tier: 'sonnet' as const },
        { id: 'claude-live', label: 'Live model', tier: 'opus' as const },
      ],
    }
    const models = resolveProviderModelsForPicker(
      anthropic,
      new Set(['claude-live']),
      {
        providerId: 'anthropic',
        isActiveProvider: true,
      },
    )
    expect(models.map(model => model.id)).toEqual(['claude-live'])
  })

  test('Meta picker keeps catalog Muse Spark models and drops media ids', () => {
    const meta = {
      id: 'meta',
      baseUrl: 'https://api.meta.ai',
      models: [
        { id: 'muse-spark-1.3', label: 'Muse Spark 1.3', tier: 'opus' as const },
        { id: 'muse-spark-1.1', label: 'Muse Spark 1.1', tier: 'sonnet' as const },
      ],
    }
    const models = resolveProviderModelsForPicker(
      meta,
      new Set(['muse-image-1.0', 'muse-voice-transcribe-1.0', 'muse-spark-1.1']),
      { providerId: 'meta' },
    )
    expect(models.map(model => model.id)).toEqual([
      'muse-spark-1.3',
      'muse-spark-1.1',
    ])
  })
})
