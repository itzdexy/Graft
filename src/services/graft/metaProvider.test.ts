import { describe, expect, test } from 'bun:test'
import {
  getDefaultModelId,
  getProvider,
  isValidKey,
} from '../../../scripts/graft-providers.js'
import { providerNeedsOpenAiCompat } from '../../../scripts/graft-provider-upstream.js'
import { resolveProviderModelsForPicker } from './catalogModels.js'
import { isAgentSuitableOpenAiModel } from './openAiModelSuitability.js'
import {
  filterMetaPickerModelIds,
  isMetaAgentModelId,
  isMetaMediaModelId,
  isMetaMessagesBaseUrl,
  isMetaProviderId,
  isMuseSparkAlwaysReasoning,
  isMuseSparkModelId,
  metaCatalogDescriptors,
  META_MESSAGES_BASE_URL,
  META_SPARK_MODEL_IDS,
  metaProbeTreatsEmptyOutputAsSuccess,
  normalizeMetaMessagesBaseUrl,
  remapMetaThinkingConfig,
  shouldSkipMetaChatProbe,
  toMetaOutputEffort,
} from './metaProvider.js'

const SPARK_IDS = [
  'muse-spark-1.3',
  'muse-spark-1.3-contributor',
  'muse-spark-1.2',
  'muse-spark-1.2-contributor',
  'muse-spark-1.1',
]

describe('Meta Model API catalog', () => {
  test('uses Anthropic Messages at api.meta.ai with Bearer MODEL_API_KEY', () => {
    const meta = getProvider('meta')
    expect(meta).not.toBeNull()
    expect(meta?.label).toBe('Meta')
    expect(meta?.category).toBe('direct')
    expect(meta?.baseUrl).toBe(META_MESSAGES_BASE_URL)
    expect(meta?.authMode).toBe('authToken')
    expect(meta?.apiFormat).not.toBe('openai')
    expect(meta?.keyPrefix).toBe('')
    expect(meta?.keyHint).toBe('MODEL_API_KEY')
    expect(meta?.defaultModel).toBe('muse-spark-1.3')
    expect(meta?.anyModel).toBeFalsy()
    expect(providerNeedsOpenAiCompat(meta)).toBe(false)
  })

  test('lists every Muse Spark chat model Meta currently serves', () => {
    const meta = getProvider('meta')
    const ids = (meta?.models ?? []).map((model: { id: string }) => model.id)
    expect(ids).toEqual(SPARK_IDS)
    expect(getDefaultModelId(meta)).toBe('muse-spark-1.3')
    expect([...META_SPARK_MODEL_IDS]).toEqual(SPARK_IDS)
  })

  test('accepts a normal long API key without an LLM| prefix', () => {
    const meta = getProvider('meta')
    expect(isValidKey(meta, 'meta-model-api-key-example-token-value')).toBe(
      true,
    )
    expect(isValidKey(meta, 'LLM|607358788850350|examplekeyvalue')).toBe(true)
    expect(isValidKey(meta, 'short')).toBe(false)
    expect(isValidKey(meta, '')).toBe(false)
  })
})

describe('Meta Muse Spark filtering', () => {
  test('identifies spark coding models and rejects media models', () => {
    expect(isMetaProviderId('meta')).toBe(true)
    expect(isMetaMessagesBaseUrl('https://api.meta.ai')).toBe(true)
    expect(isMetaMessagesBaseUrl('https://api.meta.ai/v1')).toBe(true)
    expect(normalizeMetaMessagesBaseUrl('https://api.meta.ai/v1')).toBe(
      'https://api.meta.ai',
    )
    expect(normalizeMetaMessagesBaseUrl('https://api.meta.ai/v1/')).toBe(
      'https://api.meta.ai',
    )
    expect(isMuseSparkModelId('muse-spark-1.3-contributor')).toBe(true)
    expect(isMetaAgentModelId('muse-spark-1.3')).toBe(true)
    expect(isMetaAgentModelId('muse-image-1.0')).toBe(false)
    expect(isMetaAgentModelId('muse-voice-transcribe-1.0')).toBe(false)
    expect(isMetaMediaModelId('muse-image-1.0')).toBe(true)
    expect(isMetaMediaModelId('muse-voice-transcribe-1.0')).toBe(true)
    expect(isMuseSparkAlwaysReasoning('muse-spark-1.1')).toBe(true)
  })

  test('picker never surfaces image or voice models, even if /v1/models lists them', () => {
    const meta = getProvider('meta')
    const models = resolveProviderModelsForPicker(
      meta,
      new Set([
        'muse-spark-1.1',
        'muse-image-1.0',
        'muse-voice-transcribe-1.0',
        'muse-spark-1.3-contributor',
      ]),
      { providerId: 'meta' },
    )
    const ids = models.map(model => model.id)
    expect(ids).toEqual(SPARK_IDS)
    expect(ids).not.toContain('muse-image-1.0')
    expect(ids).not.toContain('muse-voice-transcribe-1.0')
  })

  test('live-id filter keeps spark only', () => {
    expect(
      filterMetaPickerModelIds([
        'muse-spark-1.3',
        'muse-image-1.0',
        'muse-voice-transcribe-1.0',
        'muse-spark-1.2-contributor',
      ]),
    ).toEqual(['muse-spark-1.3', 'muse-spark-1.2-contributor'])
  })

  test('suitability helper also rejects Meta media model ids', () => {
    expect(isAgentSuitableOpenAiModel('muse-spark-1.3')).toBe(true)
    expect(isAgentSuitableOpenAiModel('muse-image-1.0')).toBe(false)
    expect(isAgentSuitableOpenAiModel('muse-voice-transcribe-1.0')).toBe(false)
  })

  test('catalog descriptors used instead of live /v1/models', () => {
    const descriptors = metaCatalogDescriptors()
    expect(descriptors.map(model => model.id)).toEqual(SPARK_IDS)
    expect(descriptors.every(model => model.source === 'catalog')).toBe(true)
    expect(descriptors.every(model => model.supportsReasoning === true)).toBe(
      true,
    )
  })
})

describe('Meta thinking remap', () => {
  test('never leaves thinking disabled for Muse Spark', () => {
    expect(remapMetaThinkingConfig({ type: 'disabled' })).toEqual({
      type: 'adaptive',
    })
    expect(remapMetaThinkingConfig(undefined)).toEqual({ type: 'adaptive' })
    expect(remapMetaThinkingConfig(null)).toEqual({ type: 'adaptive' })
    expect(remapMetaThinkingConfig({ type: 'adaptive' })).toEqual({
      type: 'adaptive',
    })
  })

  test('raises too-small enabled budgets to adaptive', () => {
    expect(
      remapMetaThinkingConfig({ type: 'enabled', budget_tokens: 16 }),
    ).toEqual({ type: 'adaptive' })
    expect(
      remapMetaThinkingConfig({ type: 'enabled', budget_tokens: 2048 }),
    ).toEqual({ type: 'enabled', budget_tokens: 2048 })
  })

  test('maps user-facing effort onto Meta output_config.effort', () => {
    expect(toMetaOutputEffort('low')).toBe('low')
    expect(toMetaOutputEffort('medium')).toBe('medium')
    expect(toMetaOutputEffort('high')).toBe('high')
    expect(toMetaOutputEffort('max')).toBe('xhigh')
    expect(toMetaOutputEffort('xhigh')).toBe('xhigh')
    expect(toMetaOutputEffort(undefined)).toBe('high')
    expect(toMetaOutputEffort('none')).toBe('high')
  })
})

describe('Meta probe policy', () => {
  test('does not chat-probe catalog spark models after key verify', () => {
    expect(shouldSkipMetaChatProbe('meta', 'muse-spark-1.3-contributor')).toBe(
      true,
    )
    expect(shouldSkipMetaChatProbe('meta', 'muse-image-1.0')).toBe(false)
    expect(shouldSkipMetaChatProbe('openrouter', 'muse-spark-1.3')).toBe(false)
  })

  test('empty visible text is not a spark failure', () => {
    expect(
      metaProbeTreatsEmptyOutputAsSuccess('meta', 'muse-spark-1.1'),
    ).toBe(true)
    expect(
      metaProbeTreatsEmptyOutputAsSuccess('meta', 'muse-image-1.0'),
    ).toBe(false)
  })
})
